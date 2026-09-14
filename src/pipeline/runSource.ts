import { connectors } from "../connectors/index.js";
import { extractItem } from "../extraction/extractor.js";
import { upsertRawItem, markExtracted } from "../db/repositories/rawItems.js";
import { upsertItem } from "../db/repositories/items.js";
import { getCursor, saveCursor } from "../db/repositories/syncCursors.js";
import { startRun, finishRun } from "../db/repositories/pipelineRuns.js";
import { env } from "../config/env.js";
import { logger } from "../util/logger.js";
import { SOURCES, type Source } from "../types.js";

export async function runSource(source: Source): Promise<void> {
  if (!SOURCES.includes(source)) {
    throw new Error(`invalid source: ${source}`);
  }
  const connector = connectors[source];
  const cursor = await getCursor(source);
  const runId = await startRun(source);
  const stats = { fetched: 0, extracted: 0, failed: 0 };

  try {
    const { items, nextCursor } = await connector.fetchSince(cursor);
    stats.fetched = items.length;
    logger.info("source.fetched", { source, count: items.length });

    for (const raw of items) {
      try {
        const { row, changed } = await upsertRawItem(raw);
        if (!changed) continue;

        const extracted = await extractItem(raw);
        await upsertItem(raw, row.id, extracted, env.EXTRACTION_MODEL);
        await markExtracted(row.id);
        stats.extracted += 1;
      } catch (err) {
        stats.failed += 1;
        logger.error("item.failed", { source, sourceId: raw.sourceId, error: (err as Error).message });
      }
    }

    await saveCursor(source, nextCursor, "ok");
    await finishRun(runId, stats, "ok");
    logger.info("source.done", { source, ...stats });
  } catch (err) {
    const message = (err as Error).message;
    await saveCursor(source, cursor, "error", message);
    await finishRun(runId, stats, "error", message);
    logger.error("source.failed", { source, error: message });
    throw err;
  }
}
