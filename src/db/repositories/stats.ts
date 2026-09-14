import { pool } from "../client.js";
import type { Category, Source } from "../../types.js";

export interface TodayCounts {
  total: number;
  bySource: Record<Source, number>;
}

export async function getTodayCounts(): Promise<TodayCounts> {
  const { rows } = await pool.query<{ source: Source; count: string }>(
    `select source, count(*)::int as count
     from items
     where source_created_at >= date_trunc('day', now())
       and source_created_at < date_trunc('day', now()) + interval '1 day'
     group by source`
  );

  const bySource: Record<Source, number> = { email: 0, notion: 0, linear: 0, calendar: 0 };
  let total = 0;
  for (const row of rows) {
    const count = Number(row.count);
    bySource[row.source] = count;
    total += count;
  }
  return { total, bySource };
}

interface RangeOpts {
  days?: number;
  fromDate?: string;
  toDate?: string;
}

/** Either an explicit [fromDate, toDate] window, or a trailing N-day window ending now. */
function rangeFilter(opts: RangeOpts, startParamIndex = 1): { clause: string; params: unknown[] } {
  if (opts.fromDate || opts.toDate) {
    const params: unknown[] = [];
    const parts: string[] = [];
    if (opts.fromDate) {
      params.push(opts.fromDate);
      parts.push(`source_created_at >= $${startParamIndex + params.length - 1}`);
    }
    if (opts.toDate) {
      params.push(opts.toDate);
      parts.push(`source_created_at <= $${startParamIndex + params.length - 1}`);
    }
    return { clause: parts.join(" and "), params };
  }
  return {
    clause: `source_created_at >= now() - ($${startParamIndex} || ' days')::interval`,
    params: [opts.days ?? 30],
  };
}

export const GRANULARITIES = ["second", "minute", "hour", "day", "week", "month", "quarter", "year"] as const;
export type Granularity = (typeof GRANULARITIES)[number];

export interface SeriesPoint {
  bucket: string;
  source: Source;
  category: Category | null;
  count: number;
}

export interface SeriesFilters extends RangeOpts {
  granularity?: Granularity;
  source?: Source;
  category?: Category;
  splitByCategory?: boolean;
}

/** Time-bucketed counts, zoomable from year down to second, for line/area/bar trend charts. */
export async function getSeries(filters: SeriesFilters): Promise<SeriesPoint[]> {
  const granularity = filters.granularity ?? "day";
  if (!GRANULARITIES.includes(granularity)) {
    throw new Error(`invalid granularity: ${granularity}`);
  }
  const { clause: rangeClause, params } = rangeFilter(filters);
  const clauses = [rangeClause];

  if (filters.source) {
    params.push(filters.source);
    clauses.push(`source = $${params.length}`);
  }
  if (filters.category) {
    params.push(filters.category);
    clauses.push(`category = $${params.length}`);
  }

  const categoryColumn = filters.splitByCategory ? "category" : "null";

  const { rows } = await pool.query<{ bucket: string; source: Source; category: Category | null; count: string }>(
    `select date_trunc('${granularity}', source_created_at)::text as bucket,
            source,
            ${categoryColumn} as category,
            count(*)::int as count
     from items
     where ${clauses.join(" and ")}
     group by bucket, source${filters.splitByCategory ? ", category" : ""}
     order by bucket asc, source asc`,
    params
  );

  return rows.map((row) => ({ ...row, count: Number(row.count) }));
}

type Dimension = "source" | "category";
const DIMENSION_COLUMNS: Record<Dimension, string> = { source: "source", category: "category" };

export interface BreakdownSlice {
  label: string;
  count: number;
  percent: number;
}

/** Share of items per source/category over a window — pie/donut chart data. */
export async function getBreakdown(opts: RangeOpts & { by: Dimension }): Promise<BreakdownSlice[]> {
  const column = DIMENSION_COLUMNS[opts.by];
  const { clause, params } = rangeFilter(opts);

  const { rows } = await pool.query<{ label: string; count: string }>(
    `select ${column} as label, count(*)::int as count
     from items
     where ${clause}
     group by ${column}
     order by count desc`,
    params
  );

  const total = rows.reduce((sum, row) => sum + Number(row.count), 0);
  return rows.map((row) => ({
    label: row.label,
    count: Number(row.count),
    percent: total ? Math.round((Number(row.count) / total) * 1000) / 10 : 0,
  }));
}

export interface ComparePoint {
  label: string;
  current: number;
  previous: number;
}

/** Current vs previous period per source/category — paired bar (target-vs-actual style) data. */
export async function getCompare(opts: RangeOpts & { groupBy: Dimension }): Promise<ComparePoint[]> {
  const column = DIMENSION_COLUMNS[opts.groupBy];

  let currentStart: string;
  let currentEnd: string;
  let previousStart: string;

  if (opts.fromDate && opts.toDate) {
    currentStart = opts.fromDate;
    currentEnd = opts.toDate;
    const spanMs = new Date(opts.toDate).getTime() - new Date(opts.fromDate).getTime();
    previousStart = new Date(new Date(opts.fromDate).getTime() - spanMs).toISOString();
  } else {
    const days = opts.days ?? 7;
    currentEnd = new Date().toISOString();
    currentStart = new Date(Date.now() - days * 86_400_000).toISOString();
    previousStart = new Date(Date.now() - days * 2 * 86_400_000).toISOString();
  }

  const { rows } = await pool.query<{ label: string; current: string; previous: string }>(
    `select ${column} as label,
            count(*) filter (where source_created_at >= $1 and source_created_at <= $2)::int as current,
            count(*) filter (where source_created_at >= $3 and source_created_at < $1)::int as previous
     from items
     where source_created_at >= $3 and source_created_at <= $2
     group by ${column}
     order by current desc`,
    [currentStart, currentEnd, previousStart]
  );

  return rows.map((row) => ({
    label: row.label,
    current: Number(row.current),
    previous: Number(row.previous),
  }));
}

export interface DistributionBucket {
  bucket: string;
  count: number;
}

/** Histogram over hour-of-day (when items typically arrive) or AI extraction confidence. */
export async function getDistribution(
  opts: RangeOpts & { field: "hour_of_day" | "confidence" }
): Promise<DistributionBucket[]> {
  const { clause, params } = rangeFilter(opts);

  if (opts.field === "hour_of_day") {
    const { rows } = await pool.query<{ bucket: string; count: string }>(
      `select extract(hour from source_created_at)::int::text as bucket, count(*)::int as count
       from items
       where ${clause}
       group by bucket
       order by bucket::int asc`,
      params
    );
    return rows.map((row) => ({ bucket: row.bucket, count: Number(row.count) }));
  }

  const { rows } = await pool.query<{ bucket: string; count: string }>(
    `select to_char(floor(extraction_confidence * 10) / 10, 'FM0.0') as bucket, count(*)::int as count
     from items
     where extraction_confidence is not null and ${clause}
     group by bucket
     order by bucket asc`,
    params
  );
  return rows.map((row) => ({ bucket: row.bucket, count: Number(row.count) }));
}
