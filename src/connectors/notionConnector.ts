import { Client } from "@notionhq/client";
import { env } from "../config/env.js";
import type { Connector, RawFetchedItem } from "../types.js";

const notion = new Client({ auth: env.NOTION_API_KEY });

function extractTitle(properties: Record<string, any>): string {
  for (const prop of Object.values(properties)) {
    if (prop?.type === "title") {
      return (prop.title as { plain_text: string }[]).map((t) => t.plain_text).join("") || "Untitled";
    }
  }
  return "Untitled";
}

export const notionConnector: Connector = {
  source: "notion",

  async fetchSince(cursor) {
    const since = (cursor.since as string) ?? new Date(0).toISOString();
    let newestSeen = since;
    const items: RawFetchedItem[] = [];
    let startCursor: string | undefined;

    outer: while (true) {
      const res: any = await notion.search({
        sort: { direction: "descending", timestamp: "last_edited_time" },
        filter: { property: "object", value: "page" },
        start_cursor: startCursor,
        page_size: 50,
      });

      for (const page of res.results as any[]) {
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
