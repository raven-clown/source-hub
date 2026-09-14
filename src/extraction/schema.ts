import { z } from "zod";
import type Anthropic from "@anthropic-ai/sdk";

export const categories = ["urgent_reply", "fyi", "billing", "task", "appointment", "promo"] as const;

export const extractedItemSchema = z.object({
  senderName: z.string().nullable(),
  senderIdentifier: z.string().nullable(),
  originOrg: z.string().nullable(),
  title: z.string(),
  summary: z.string(),
  category: z.enum(categories),
  eventAt: z.string().nullable(),
  eventAtType: z.enum(["deadline", "meeting"]).nullable(),
  confidence: z.number().min(0).max(1),
});

export const extractionTool: Anthropic.Tool = {
  name: "record_extraction",
  description: "Record the structured extraction of a source item.",
  input_schema: {
    type: "object",
    properties: {
      senderName: { type: ["string", "null"], description: "Display name of the sender/creator/assignee" },
      senderIdentifier: { type: ["string", "null"], description: "Email address or source-native user id" },
      originOrg: { type: ["string", "null"], description: "Company or team the item originated from" },
      title: { type: "string", description: "Short human title for the item" },
      summary: { type: "string", description: "1-3 sentence summary of the substantive content, not a copy of the raw title" },
      category: { type: "string", enum: [...categories] },
      eventAt: { type: ["string", "null"], description: "ISO 8601 timestamp for a deadline or meeting time, if any" },
      eventAtType: { type: ["string", "null"], enum: ["deadline", "meeting", null] },
      confidence: { type: "number", minimum: 0, maximum: 1 },
    },
    required: ["senderName", "senderIdentifier", "originOrg", "title", "summary", "category", "eventAt", "eventAtType", "confidence"] as string[],
  },
};
