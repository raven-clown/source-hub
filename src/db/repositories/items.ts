import { pool } from "../client.js";
import type { Category, ExtractedItem, RawFetchedItem, Source } from "../../types.js";

export interface ItemRow {
  id: string;
  raw_item_id: string;
  source: Source;
  source_id: string;
  source_url: string | null;
  sender_name: string | null;
  sender_identifier: string | null;
  origin_org: string | null;
  title: string;
  summary: string;
  category: Category;
  event_at: string | null;
  event_at_type: "deadline" | "meeting" | null;
  source_created_at: string;
  status: "new" | "in_progress" | "done" | "archived";
  extraction_model: string;
  extraction_confidence: number | null;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export async function upsertItem(
  raw: RawFetchedItem,
  rawItemId: string,
  extracted: ExtractedItem,
  extractionModel: string,
  metadata: Record<string, unknown> = {}
): Promise<ItemRow> {
  const { rows } = await pool.query<ItemRow>(
    `insert into items (
       raw_item_id, source, source_id, source_url,
       sender_name, sender_identifier, origin_org,
       title, summary, category, event_at, event_at_type,
       source_created_at, extraction_model, extraction_confidence, metadata
     ) values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)
     on conflict (source, source_id) do update
       set raw_item_id = excluded.raw_item_id,
           source_url = excluded.source_url,
           sender_name = excluded.sender_name,
           sender_identifier = excluded.sender_identifier,
           origin_org = excluded.origin_org,
           title = excluded.title,
           summary = excluded.summary,
           category = excluded.category,
           event_at = excluded.event_at,
           event_at_type = excluded.event_at_type,
           extraction_model = excluded.extraction_model,
           extraction_confidence = excluded.extraction_confidence,
           metadata = excluded.metadata
     returning *`,
    [
      rawItemId,
      raw.source,
      raw.sourceId,
      raw.sourceUrl,
      extracted.senderName,
      extracted.senderIdentifier,
      extracted.originOrg,
      extracted.title,
      extracted.summary,
      extracted.category,
      extracted.eventAt,
      extracted.eventAtType,
      raw.sourceCreatedAt,
      extractionModel,
      extracted.confidence,
      metadata,
    ]
  );
  return rows[0];
}

export interface ItemFilters {
  sources?: Source[];
  categories?: Category[];
  status?: ItemRow["status"];
  fromDate?: string;
  toDate?: string;
  search?: string;
  limit?: number;
}

export async function queryItems(filters: ItemFilters): Promise<ItemRow[]> {
  const clauses: string[] = [];
  const params: unknown[] = [];

  if (filters.sources?.length) {
    params.push(filters.sources);
    clauses.push(`source = any($${params.length})`);
  }
  if (filters.categories?.length) {
    params.push(filters.categories);
    clauses.push(`category = any($${params.length})`);
  }
  if (filters.status) {
    params.push(filters.status);
    clauses.push(`status = $${params.length}`);
  }
  if (filters.fromDate) {
    params.push(filters.fromDate);
    clauses.push(`coalesce(event_at, source_created_at) >= $${params.length}`);
  }
  if (filters.toDate) {
    params.push(filters.toDate);
    clauses.push(`coalesce(event_at, source_created_at) <= $${params.length}`);
  }
  if (filters.search) {
    params.push(filters.search);
    clauses.push(`search_text @@ plainto_tsquery('simple', $${params.length})`);
  }

  const where = clauses.length ? `where ${clauses.join(" and ")}` : "";
  const limit = Math.min(Math.max(filters.limit ?? 100, 1), 500);
  params.push(limit);

  const { rows } = await pool.query<ItemRow>(
    `select * from items ${where} order by coalesce(event_at, source_created_at) desc limit $${params.length}`,
    params
  );
  return rows;
}

export async function getItem(id: string): Promise<ItemRow | null> {
  const { rows } = await pool.query<ItemRow>("select * from items where id = $1", [id]);
  return rows[0] ?? null;
}

export async function setItemStatus(id: string, status: ItemRow["status"]): Promise<ItemRow | null> {
  const { rows } = await pool.query<ItemRow>(
    "update items set status = $2 where id = $1 returning *",
    [id, status]
  );
  return rows[0] ?? null;
}
