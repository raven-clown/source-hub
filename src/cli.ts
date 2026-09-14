import { runAll } from "./pipeline/runAll.js";
import { runSource } from "./pipeline/runSource.js";
import { startServer } from "./mcp-server/server.js";
import { startApiServer } from "./api/server.js";
import { pool } from "./db/client.js";
import { logger } from "./util/logger.js";
import type { Source } from "./types.js";

const SOURCES: Source[] = ["email", "notion", "linear", "calendar"];

async function main() {
  const [command, ...rest] = process.argv.slice(2);

  switch (command) {
    case "sync": {
      const sourceArg = rest.find((a) => a.startsWith("--source="))?.split("=")[1];
      if (sourceArg) {
        if (!SOURCES.includes(sourceArg as Source)) {
          throw new Error(`unknown source: ${sourceArg}`);
        }
        await runSource(sourceArg as Source);
      } else {
        await runAll();
      }
      await pool.end();
      break;
    }
    case "mcp": {
      await startServer();
      break;
    }
    case "api": {
      await startApiServer();
      break;
    }
    default:
      logger.error("cli.unknownCommand", { command });
      process.exitCode = 1;
      await pool.end();
  }
}

main().catch(async (err) => {
  logger.error("cli.fatal", { error: (err as Error).message });
  await pool.end();
  process.exit(1);
});
