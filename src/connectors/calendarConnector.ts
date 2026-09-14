import { google } from "googleapis";
import { env } from "../config/env.js";
import type { Connector, RawFetchedItem } from "../types.js";

function client() {
  const oauth2 = new google.auth.OAuth2(env.GCAL_CLIENT_ID, env.GCAL_CLIENT_SECRET);
  oauth2.setCredentials({ refresh_token: env.GCAL_REFRESH_TOKEN });
  return google.calendar({ version: "v3", auth: oauth2 });
}

export const calendarConnector: Connector = {
  source: "calendar",

  async fetchSince(cursor) {
    const calendar = client();
    const since = (cursor.since as string) ?? new Date(0).toISOString();
    const now = new Date().toISOString();

    const items: RawFetchedItem[] = [];
    let pageToken: string | undefined;

    do {
      const res = await calendar.events.list({
        calendarId: env.GCAL_CALENDAR_ID,
        updatedMin: since,
        singleEvents: true,
        orderBy: "updated",
        showDeleted: false,
        maxResults: 100,
        pageToken,
      });

      for (const event of res.data.items ?? []) {
        if (!event.id || event.status === "cancelled") continue;
        const start = event.start?.dateTime ?? event.start?.date ?? event.created ?? now;

        items.push({
          source: "calendar",
          sourceId: event.id,
          sourceUrl: event.htmlLink ?? null,
          sourceCreatedAt: event.created ?? start,
          payload: {
            summary: event.summary,
            description: event.description,
            location: event.location,
            start,
            end: event.end?.dateTime ?? event.end?.date,
            organizer: event.organizer?.email,
            attendees: event.attendees?.map((a) => a.email),
            updated: event.updated,
          },
        });
      }

      pageToken = res.data.nextPageToken ?? undefined;
    } while (pageToken);

    return { items, nextCursor: { since: now } };
  },
};
