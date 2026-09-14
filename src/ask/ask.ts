import { getLlmProvider, type ToolSpec } from "../llm/index.js";
import { queryItems, type ItemFilters, type ItemRow } from "../db/repositories/items.js";
import { categories } from "../extraction/schema.js";

const queryTool: ToolSpec = {
  name: "query_items",
  description: "Search the unified items database pulled from email, Notion, Linear and Google Calendar.",
  schema: {
    type: "object",
    properties: {
      sources: { type: "array", items: { type: "string", enum: ["email", "notion", "linear", "calendar"] } },
      categories: { type: "array", items: { type: "string", enum: [...categories] } },
      status: { type: "string", enum: ["new", "in_progress", "done", "archived"] },
      fromDate: { type: "string", description: "ISO 8601, inclusive lower bound on the item's relevant date" },
      toDate: { type: "string", description: "ISO 8601, inclusive upper bound on the item's relevant date" },
      search: { type: "string", description: "free-text search over title and summary" },
      limit: { type: "number" },
    },
    required: [],
  },
};

const SYSTEM_PROMPT = `You answer questions about the user's items pulled from email, Notion, Linear and Google Calendar.
Always call query_items to look up data before answering — never guess or invent items.
Call it more than once if the question needs more than one filter combination (e.g. "urgent stuff or anything due today" needs two calls).
Once you have enough results, write a concise natural-language answer. Refer to items by title, not by id. If nothing matches, say so plainly.`;

export interface AskResult {
  answer: string;
  items: ItemRow[];
}

export async function ask(question: string): Promise<AskResult> {
  const provider = getLlmProvider();
  const seenItems = new Map<string, ItemRow>();

  const answer = await provider.runAgentLoop({
    system: `${SYSTEM_PROMPT}\nToday is ${new Date().toISOString()}.`,
    userMessage: question,
    tool: queryTool,
    runTool: async (input) => {
      const rows = await queryItems(input as ItemFilters);
      for (const row of rows) seenItems.set(row.id, row);
      return rows;
    },
  });

  return { answer, items: [...seenItems.values()] };
}
