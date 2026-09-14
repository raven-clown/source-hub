import type { FastifyPluginAsync } from "fastify";
import { queryItems, getItem, setItemStatus, type ItemFilters, type ItemRow } from "../../db/repositories/items.js";

export const itemsRoutes: FastifyPluginAsync = async (app) => {
  app.get("/", async (req) => {
    const q = req.query as Record<string, string | undefined>;
    const filters: ItemFilters = {
      sources: q.sources?.split(",") as ItemFilters["sources"],
      categories: q.categories?.split(",") as ItemFilters["categories"],
      status: q.status as ItemFilters["status"],
      fromDate: q.fromDate,
      toDate: q.toDate,
      search: q.search,
      limit: q.limit ? Number(q.limit) : undefined,
    };
    return queryItems(filters);
  });

  app.get("/:id", async (req, reply) => {
    const { id } = req.params as { id: string };
    const row = await getItem(id);
    if (!row) return reply.code(404).send({ error: "not found" });
    return row;
  });

  app.patch("/:id/status", async (req, reply) => {
    const { id } = req.params as { id: string };
    const { status } = req.body as { status?: ItemRow["status"] };
    if (!status) return reply.code(400).send({ error: "status is required" });
    const row = await setItemStatus(id, status);
    if (!row) return reply.code(404).send({ error: "not found" });
    return row;
  });
};
