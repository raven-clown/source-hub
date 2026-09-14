import type { FastifyPluginAsync } from "fastify";
import {
  getTodayCounts,
  getSeries,
  getBreakdown,
  getCompare,
  getDistribution,
  GRANULARITIES,
  type Granularity,
} from "../../db/repositories/stats.js";
import type { Category, Source } from "../../types.js";

const DIMENSIONS = ["source", "category"] as const;
const DISTRIBUTION_FIELDS = ["hour_of_day", "confidence"] as const;

function rangeParams(q: Record<string, string | undefined>) {
  return {
    days: q.days ? Number(q.days) : undefined,
    fromDate: q.fromDate,
    toDate: q.toDate,
  };
}

export const statsRoutes: FastifyPluginAsync = async (app) => {
  app.get("/today", async () => getTodayCounts());

  app.get("/series", async (req, reply) => {
    const q = req.query as Record<string, string | undefined>;
    const granularity = q.granularity ?? "day";
    if (!GRANULARITIES.includes(granularity as Granularity)) {
      return reply.code(400).send({ error: `granularity must be one of ${GRANULARITIES.join(", ")}` });
    }
    return getSeries({
      ...rangeParams(q),
      granularity: granularity as Granularity,
      source: q.source as Source | undefined,
      category: q.category as Category | undefined,
      splitByCategory: q.splitByCategory === "true",
    });
  });

  app.get("/breakdown", async (req, reply) => {
    const q = req.query as Record<string, string | undefined>;
    const by = q.by ?? "category";
    if (!DIMENSIONS.includes(by as (typeof DIMENSIONS)[number])) {
      return reply.code(400).send({ error: `by must be one of ${DIMENSIONS.join(", ")}` });
    }
    return getBreakdown({ ...rangeParams(q), by: by as (typeof DIMENSIONS)[number] });
  });

  app.get("/compare", async (req, reply) => {
    const q = req.query as Record<string, string | undefined>;
    const groupBy = q.groupBy ?? "category";
    if (!DIMENSIONS.includes(groupBy as (typeof DIMENSIONS)[number])) {
      return reply.code(400).send({ error: `groupBy must be one of ${DIMENSIONS.join(", ")}` });
    }
    return getCompare({ ...rangeParams(q), groupBy: groupBy as (typeof DIMENSIONS)[number] });
  });

  app.get("/distribution", async (req, reply) => {
    const q = req.query as Record<string, string | undefined>;
    const field = q.field ?? "hour_of_day";
    if (!DISTRIBUTION_FIELDS.includes(field as (typeof DISTRIBUTION_FIELDS)[number])) {
      return reply.code(400).send({ error: `field must be one of ${DISTRIBUTION_FIELDS.join(", ")}` });
    }
    return getDistribution({ ...rangeParams(q), field: field as (typeof DISTRIBUTION_FIELDS)[number] });
  });
};
