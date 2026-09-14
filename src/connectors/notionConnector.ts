import { Client } from "@notionhq/client";
import { env } from "../config/env.js";
import type { Connector, RawFetchedItem } from "../types.js";

function client(): Client {
  return new Client({ auth: env.NOTION_API_KEY });
}

interface NotionProperty {
  type: string;
  title?: { plain_text: string }[];
}

interface NotionPage {
  id: string;
  url?: string;
  created_time: string;
  last_edited_time: string;
  properties?: Record<string, NotionProperty>;
  parent?: unknown;
  created_by?: { id: string };
  last_edited_by?: { id: string };
}

interface NotionSearchResponse {
  results: NotionPage[];
  has_more: boolean;
  next_cursor: string | null;
}

function extractTitle(properties: Record<string, NotionProperty>): string {
  for (const prop of Object.values(properties)) {
    if (prop.type === "title" && prop.title) {
      return prop.title.map((t) => t.plain_text).join("") || "Untitled";
    }
  }
  return "Untitled";
}

export const notionConnector: Connector = {
  source: "notion",

  async fetchSince(cursor) {
    const notion = client();
    const since = (cursor.since as string) ?? new Date(0).toISOString();
    let newestSeen = since;
    const items: RawFetchedItem[] = [];
    let startCursor: string | undefined;

    outer: while (true) {
      const res = (await notion.search({
        sort: { direction: "descending", timestamp: "last_edited_time" },
        filter: { property: "object", value: "page" },
        start_cursor: startCursor,
        page_size: 50,
      })) as unknown as NotionSearchResponse;

      for (const page of res.results) {
        if (page.last_edited_time <= since) break outer;
        if (page.last_edited_time > newestSeen) newestSeen = page.last_edited_time;

        items.push({
          source: "notion",
          sourceId: page.id,
          sourceUrl: page.url ?? null,
          sourceCreatedAt: page.created_time,
          payload: {
            title: extractTitle(page.properties ?? {}),
            properties: page.properties,
            parent: page.parent,
            createdBy: page.created_by?.id,
            lastEditedBy: page.last_edited_by?.id,
            lastEditedTime: page.last_edited_time,
          },
        });
      }

      if (!res.has_more) break;
      startCursor = res.next_cursor ?? undefined;
    }

    return { items, nextCursor: { since: newestSeen } };
  },
};
