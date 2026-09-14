import Anthropic from "@anthropic-ai/sdk";
import { env } from "../config/env.js";
import { queryItems, type ItemFilters, type ItemRow } from "../db/repositories/items.js";
import { categories } from "../extraction/schema.js";

const anthropic = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY });

const queryTool: Anthropic.Tool = {
  name: "query_items",
  description: "Search the unified items database pulled from email, Notion, Linear and Google Calendar.",
  input_schema: {
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
  const messages: Anthropic.MessageParam[] = [{ role: "user", content: question }];
  const seenItems = new Map<string, ItemRow>();

  for (let turn = 0; turn < 4; turn++) {
    const response = await anthropic.messages.create({
      model: env.EXTRACTION_MODEL,
      max_tokens: 1024,
      system: `${SYSTEM_PROMPT}\nToday is ${new Date().toISOString()}.`,
      tools: [queryTool],
      messages,
    });

    const toolUses = response.content.filter(
      (block): block is Anthropic.ToolUseBlock => block.type === "tool_use"
    );

    if (toolUses.length === 0) {
      const text = response.content.find(
        (block): block is Anthropic.TextBlock => block.type === "text"
      );
      return { answer: text?.text ?? "", items: [...seenItems.values()] };
    }

    messages.push({ role: "assistant", content: response.content });

    const toolResults: Anthropic.ToolResultBlockParam[] = [];
    for (const toolUse of toolUses) {
      const rows = await queryItems(toolUse.input as ItemFilters);
      for (const row of rows) seenItems.set(row.id, row);
      toolResults.push({
        type: "tool_result",
        tool_use_id: toolUse.id,
        content: JSON.stringify(rows),
      });
    }
    messages.push({ role: "user", content: toolResults });
  }

  return { answer: "Could not resolve an answer within the tool-call budget.", items: [...seenItems.values()] };
}
