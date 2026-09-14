import { pool } from "../client.js";
import type { Source } from "../../types.js";

export async function getCursor(source: Source): Promise<Record<string, unknown>> {
  const { rows } = await pool.query<{ cursor: Record<string, unknown> }>(
    "select cursor from sync_cursors where source = $1",
    [source]
  );
  return rows[0]?.cursor ?? {};
}

export async function saveCursor(
  source: Source,
  cursor: Record<string, unknown>,
  status: "ok" | "error",
  error?: string
): Promise<void> {
  await pool.query(
    `insert into sync_cursors (source, cursor, last_synced_at, last_status, last_error)
     values ($1, $2, now(), $3, $4)
     on conflict (source) do update
       set cursor = excluded.cursor,
           last_synced_at = now(),
           last_status = excluded.last_status,
           last_error = excluded.last_error`,
    [source, cursor, status, error ?? null]
  );
}
