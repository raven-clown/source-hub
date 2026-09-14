import { pool } from "../client.js";
import type { Source } from "../../types.js";

export async function startRun(source: Source): Promise<string> {
  const { rows } = await pool.query<{ id: string }>(
    "insert into pipeline_runs (source) values ($1) returning id",
    [source]
  );
  return rows[0].id;
}

export async function finishRun(
  id: string,
  stats: { fetched: number; extracted: number; failed: number },
  status: "ok" | "error",
  error?: string
): Promise<void> {
  await pool.query(
    `update pipeline_runs
     set finished_at = now(), items_fetched = $2, items_extracted = $3,
         items_failed = $4, status = $5, error = $6
     where id = $1`,
    [id, stats.fetched, stats.extracted, stats.failed, status, error ?? null]
  );
}
