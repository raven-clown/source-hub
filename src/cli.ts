import { logger } from "./util/logger.js";
import { SOURCES, type Source } from "./types.js";

async function main() {
  const [command, ...rest] = process.argv.slice(2);

  switch (command) {
    case "sync": {
      const { runAll } = await import("./pipeline/runAll.js");
      const { runSource } = await import("./pipeline/runSource.js");
      const { pool } = await import("./db/client.js");

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
      const { startServer } = await import("./mcp-server/server.js");
      await startServer();
      break;
    }
    case "api": {
      const { startApiServer } = await import("./api/server.js");
      await startApiServer();
      break;
    }
    default:
      logger.error("cli.unknownCommand", { command });
      process.exitCode = 1;
  }
}

main().catch((err) => {
  logger.error("cli.fatal", { error: (err as Error).message });
  process.exit(1);
});
