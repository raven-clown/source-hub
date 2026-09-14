export const SOURCES = ["email", "notion", "linear", "calendar"] as const;
export type Source = (typeof SOURCES)[number];

export type Category = "urgent_reply" | "fyi" | "billing" | "task" | "appointment" | "promo";

export interface RawFetchedItem {
  source: Source;
  sourceId: string;
  sourceUrl: string | null;
  sourceCreatedAt: string;
  payload: Record<string, unknown>;
}

export interface ExtractedItem {
  senderName: string | null;
  senderIdentifier: string | null;
  originOrg: string | null;
  title: string;
  summary: string;
  category: Category;
  eventAt: string | null;
  eventAtType: "deadline" | "meeting" | null;
  confidence: number;
}

export interface Connector {
  source: Source;
  fetchSince(cursor: Record<string, unknown>): Promise<{
    items: RawFetchedItem[];
    nextCursor: Record<string, unknown>;
  }>;
}
