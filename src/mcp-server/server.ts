import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { queryItems, getItem, setItemStatus } from "../db/repositories/items.js";
import { getTodayCounts, getSeries, getBreakdown, getCompare, getDistribution, GRANULARITIES } from "../db/repositories/stats.js";
import { categories } from "../extraction/schema.js";
import { logger } from "../util/logger.js";

const sourceEnum = z.enum(["email", "notion", "linear", "calendar"]);
const categoryEnum = z.enum(categories);
const statusEnum = z.enum(["new", "in_progress", "done", "archived"]);
const granularityEnum = z.enum(GRANULARITIES);
const rangeShape = {
  days: z.number().int().min(1).max(3650).optional(),
  fromDate: z.string().optional(),
  toDate: z.string().optional(),
};

export function createServer(): McpServer {
  const server = new McpServer({ name: "source-hub", version: "0.1.0" });

  server.tool(
    "query_items",
    "List extracted items across email/notion/linear/calendar with optional filters. Dates are ISO 8601.",
    {
      sources: z.array(sourceEnum).optional(),
      categories: z.array(categoryEnum).optional(),
      status: statusEnum.optional(),
      fromDate: z.string().optional(),
      toDate: z.string().optional(),
      search: z.string().optional(),
      limit: z.number().int().min(1).max(200).optional(),
    },
    async (filters) => {
      const rows = await queryItems(filters);
      return { content: [{ type: "text", text: JSON.stringify(rows, null, 2) }] };
    }
  );

  server.tool(
    "get_urgent_today",
    "Shortcut for items needing attention today: urgent replies and tasks/appointments due or scheduled today, across all sources.",
    {},
    async () => {
      const startOfDay = new Date();
      startOfDay.setHours(0, 0, 0, 0);
      const endOfDay = new Date();
      endOfDay.setHours(23, 59, 59, 999);

      const rows = await queryItems({
        categories: ["urgent_reply", "task", "appointment"],
        status: "new",
        fromDate: startOfDay.toISOString(),
        toDate: endOfDay.toISOString(),
        limit: 100,
      });
      return { content: [{ type: "text", text: JSON.stringify(rows, null, 2) }] };
    }
  );

  server.tool(
    "get_today_counts",
    "How many items came in today, broken down by source (email/notion/linear/calendar) plus a total.",
    {},
    async () => {
      const counts = await getTodayCounts();
      return { content: [{ type: "text", text: JSON.stringify(counts, null, 2) }] };
    }
  );

  server.tool(
    "get_series",
    "Time-bucketed item counts, zoomable from year down to second (default: day), for line/area/bar trend charts. Pass fromDate/toDate for a custom range instead of a trailing window; optionally filter to one source/category or split by category.",
    {
      granularity: granularityEnum.optional(),
      ...rangeShape,
      source: sourceEnum.optional(),
      category: categoryEnum.optional(),
      splitByCategory: z.boolean().optional(),
    },
    async (filters) => {
      const rows = await getSeries(filters);
      return { content: [{ type: "text", text: JSON.stringify(rows, null, 2) }] };
    }
  );

  server.tool(
    "get_breakdown",
    "Share of items by source or category over a window — pie/donut chart data (label, count, percent). Pass fromDate/toDate for a custom range instead of a trailing window.",
    {
      by: z.enum(["source", "category"]).optional(),
      ...rangeShape,
    },
    async ({ by, ...range }) => {
      const rows = await getBreakdown({ by: by ?? "category", ...range });
      return { content: [{ type: "text", text: JSON.stringify(rows, null, 2) }] };
    }
  );

  server.tool(
    "get_compare",
    "Current vs previous period counts per source or category, e.g. this week vs last week — for a target-vs-actual style paired bar chart. Pass fromDate/toDate for a custom current-period range; the previous period is the same length immediately before it.",
    {
      groupBy: z.enum(["source", "category"]).optional(),
      ...rangeShape,
    },
    async ({ groupBy, ...range }) => {
      const rows = await getCompare({ groupBy: groupBy ?? "category", ...range });
      return { content: [{ type: "text", text: JSON.stringify(rows, null, 2) }] };
    }
  );

  server.tool(
    "get_distribution",
    "Histogram of items by hour-of-day (when items typically arrive) or by AI extraction confidence — for a distribution/bell-curve style chart. Pass fromDate/toDate for a custom range instead of a trailing window.",
    {
      field: z.enum(["hour_of_day", "confidence"]).optional(),
      ...rangeShape,
    },
    async ({ field, ...range }) => {
      const rows = await getDistribution({ field: field ?? "hour_of_day", ...range });
      return { content: [{ type: "text", text: JSON.stringify(rows, null, 2) }] };
    }
  );

  server.tool(
    "get_item",
    "Fetch a single item by id.",
    { id: z.string().uuid() },
    async ({ id }) => {
      const row = await getItem(id);
      if (!row) return { content: [{ type: "text", text: "not found" }], isError: true };
      return { content: [{ type: "text", text: JSON.stringify(row, null, 2) }] };
    }
  );

  server.tool(
    "set_item_status",
    "Update an item's status, e.g. to mark it done or archived.",
    { id: z.string().uuid(), status: statusEnum },
    async ({ id, status }) => {
      const row = await setItemStatus(id, status);
      if (!row) return { content: [{ type: "text", text: "not found" }], isError: true };
      return { content: [{ type: "text", text: JSON.stringify(row, null, 2) }] };
    }
  );

  return server;
}

export async function startServer(): Promise<void> {
  const server = createServer();
  const transport = new StdioServerTransport();
  await server.connect(transport);
  logger.info("mcp.started");
}
