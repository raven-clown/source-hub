import Fastify from "fastify";
import cors from "@fastify/cors";
import { env } from "../config/env.js";
import { logger } from "../util/logger.js";
import { itemsRoutes } from "./routes/items.js";
import { askRoutes } from "./routes/ask.js";
import { statsRoutes } from "./routes/stats.js";

export function createApiServer() {
  const app = Fastify({ logger: false });

  app.register(cors, { origin: env.API_CORS_ORIGIN });

  app.addHook("onRequest", async (req, reply) => {
    if (!env.API_KEY || req.url === "/health") return;
    if (req.headers.authorization !== `Bearer ${env.API_KEY}`) {
      reply.code(401).send({ error: "unauthorized" });
    }
  });

  app.get("/health", async () => ({ ok: true }));
  app.register(itemsRoutes, { prefix: "/items" });
  app.register(askRoutes);
  app.register(statsRoutes, { prefix: "/stats" });

  return app;
}

export async function startApiServer(): Promise<void> {
  const app = createApiServer();
  await app.listen({ port: env.API_PORT, host: "0.0.0.0" });
  logger.info("api.started", { port: env.API_PORT });
}
