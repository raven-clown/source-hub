import { google } from "googleapis";
import { env } from "../config/env.js";
import type { Connector, RawFetchedItem } from "../types.js";

function client() {
  const oauth2 = new google.auth.OAuth2(env.GMAIL_CLIENT_ID, env.GMAIL_CLIENT_SECRET);
  oauth2.setCredentials({ refresh_token: env.GMAIL_REFRESH_TOKEN });
  return google.gmail({ version: "v1", auth: oauth2 });
}

function header(headers: { name?: string | null; value?: string | null }[] | undefined, name: string): string | null {
  return headers?.find((h) => h.name?.toLowerCase() === name.toLowerCase())?.value ?? null;
}

function decodeBody(payload: unknown): string {
  const p = payload as { body?: { data?: string }; parts?: unknown[] };
  if (p.body?.data) return Buffer.from(p.body.data, "base64url").toString("utf8");
  for (const part of p.parts ?? []) {
    const text = decodeBody(part);
    if (text) return text;
  }
  return "";
}

export const gmailConnector: Connector = {
  source: "email",

  async fetchSince(cursor) {
    const gmail = client();
    const sinceEpochSeconds = (cursor.sinceEpochSeconds as number | undefined) ?? 0;
    const nowEpochSeconds = Math.floor(Date.now() / 1000);

    const list = await gmail.users.messages.list({
      userId: "me",
      q: sinceEpochSeconds ? `after:${sinceEpochSeconds}` : "newer_than:7d",
      maxResults: 50,
    });

    const items: RawFetchedItem[] = [];
    for (const ref of list.data.messages ?? []) {
      if (!ref.id) continue;
      const msg = await gmail.users.messages.get({ userId: "me", id: ref.id, format: "full" });
      const headers = msg.data.payload?.headers;
      items.push({
        source: "email",
        sourceId: ref.id,
        sourceUrl: `https://mail.google.com/mail/u/0/#all/${ref.id}`,
        sourceCreatedAt: new Date(Number(msg.data.internalDate ?? Date.now())).toISOString(),
        payload: {
          subject: header(headers, "Subject"),
          from: header(headers, "From"),
          to: header(headers, "To"),
          snippet: msg.data.snippet,
          body: decodeBody(msg.data.payload).slice(0, 8000),
          labelIds: msg.data.labelIds,
          threadId: msg.data.threadId,
        },
      });
    }

    return { items, nextCursor: { sinceEpochSeconds: nowEpochSeconds } };
  },
};
