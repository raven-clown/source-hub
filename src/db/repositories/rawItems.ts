import { pool } from "../client.js";
import { hashPayload } from "../../util/hash.js";
import type { RawFetchedItem, Source } from "../../types.js";

export interface RawItemRow {
  id: string;
  source: Source;
  source_id: string;
  source_url: string | null;
  content_hash: string;
  payload: Record<string, unknown>;
  fetched_at: string;
  extracted_at: string | null;
}

export async function upsertRawItem(
  item: RawFetchedItem
): Promise<{ row: RawItemRow; changed: boolean }> {
  const contentHash = hashPayload(item.payload);

  const { rows } = await pool.query<RawItemRow>(
    `insert into raw_items (source, source_id, source_url, content_hash, payload)
     values ($1, $2, $3, $4, $5)
     on conflict (source, source_id) do update
       set source_url = excluded.source_url,
           content_hash = excluded.content_hash,
           payload = excluded.payload,
           fetched_at = now(),
           extracted_at = case
             when raw_items.content_hash = excluded.content_hash then raw_items.extracted_at
             else null
           end
     returning *`,
    [item.source, item.sourceId, item.sourceUrl, contentHash, item.payload]
  );

  const row = rows[0];
  const changed = row.extracted_at === null;
  return { row, changed };
}

export async function markExtracted(rawItemId: string): Promise<void> {
  await pool.query("update raw_items set extracted_at = now() where id = $1", [rawItemId]);
}

export async function pendingExtraction(source: Source, limit = 50): Promise<RawItemRow[]> {
  const { rows } = await pool.query<RawItemRow>(
    `select * from raw_items where source = $1 and extracted_at is null order by fetched_at asc limit $2`,
    [source, limit]
  );
  return rows;
}
