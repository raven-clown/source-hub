import Anthropic from "@anthropic-ai/sdk";
import { env } from "../config/env.js";
import { extractedItemSchema, extractionTool } from "./schema.js";
import type { ExtractedItem, RawFetchedItem } from "../types.js";

const anthropic = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY });

const SYSTEM_PROMPT = `You extract structured signal from a single item pulled from an email inbox, Notion, Linear, or Google Calendar.
Write the summary yourself in your own words: capture what the item actually means and what (if anything) the recipient needs to do, don't just restate the title.
Categories:
- urgent_reply: needs a response soon
- fyi: informational only, no action needed
- billing: invoices, receipts, payment-related
- task: work item assigned to or owned by the recipient
- appointment: a scheduled meeting or event
- promo: marketing, newsletters, ads
Only set eventAt when the source explicitly gives a deadline or meeting time distinct from when the item was created.`;

function sourceLabel(raw: RawFetchedItem): string {
  switch (raw.source) {
    case "email":
      return "Email message";
    case "notion":
      return "Notion page/database item";
    case "linear":
      return "Linear issue";
    case "calendar":
      return "Google Calendar event";
  }
}

export async function extractItem(raw: RawFetchedItem): Promise<ExtractedItem> {
  const message = await anthropic.messages.create({
    model: env.EXTRACTION_MODEL,
    max_tokens: 1024,
    system: SYSTEM_PROMPT,
    tools: [extractionTool],
    tool_choice: { type: "tool", name: extractionTool.name },
    messages: [
      {
        role: "user",
        content: `${sourceLabel(raw)}, created at ${raw.sourceCreatedAt}:\n\n${JSON.stringify(raw.payload, null, 2)}`,
      },
    ],
  });

  const toolUse = message.content.find((block) => block.type === "tool_use");
  if (!toolUse || toolUse.type !== "tool_use") {
    throw new Error("extraction model did not return a tool_use block");
  }

  return extractedItemSchema.parse(toolUse.input);
}
