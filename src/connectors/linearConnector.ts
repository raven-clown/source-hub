import { LinearClient } from "@linear/sdk";
import { env } from "../config/env.js";
import type { Connector, RawFetchedItem } from "../types.js";

function client(): LinearClient {
  return new LinearClient({ apiKey: env.LINEAR_API_KEY });
}

export const linearConnector: Connector = {
  source: "linear",

  async fetchSince(cursor) {
    const linear = client();
    const since = (cursor.since as string) ?? new Date(0).toISOString();
    let newestSeen = since;

    const result = await linear.issues({
      filter: { updatedAt: { gt: since } },
      first: 100,
    });

    const items: RawFetchedItem[] = [];
    for (const issue of result.nodes) {
      const [state, assignee, team, creator] = await Promise.all([
        issue.state,
        issue.assignee,
        issue.team,
        issue.creator,
      ]);

      const updatedAtIso = issue.updatedAt.toISOString();
      if (updatedAtIso > newestSeen) newestSeen = updatedAtIso;

      items.push({
        source: "linear",
        sourceId: issue.id,
        sourceUrl: issue.url,
        sourceCreatedAt: issue.createdAt.toISOString(),
        payload: {
          identifier: issue.identifier,
          title: issue.title,
          description: issue.description,
          priority: issue.priority,
          state: state?.name,
          assignee: assignee?.name,
          assigneeEmail: assignee?.email,
          team: team?.name,
          creator: creator?.name,
          dueDate: issue.dueDate,
          updatedAt: updatedAtIso,
        },
      });
    }

    return { items, nextCursor: { since: newestSeen } };
  },
};
