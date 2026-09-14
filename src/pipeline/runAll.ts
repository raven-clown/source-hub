import { connectors } from "../connectors/index.js";
import { runSource } from "./runSource.js";
import { logger } from "../util/logger.js";
import type { Source } from "../types.js";

export async function runAll(): Promise<void> {
  const sources = Object.keys(connectors) as Source[];

  for (const source of sources) {
    try {
      await runSource(source);
    } catch (err) {
      logger.error("runAll.sourceError", { source, error: (err as Error).message });
    }
  }
}
