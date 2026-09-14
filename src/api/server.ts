import { timingSafeEqual } from "node:crypto";
import Fastify, { type FastifyError } from "fastify";
import cors from "@fastify/cors";
import { env } from "../config/env.js";
import { logger } from "../util/logger.js";
import { itemsRoutes } from "./routes/items.js";
import { askRoutes } from "./routes/ask.js";
import { statsRoutes } from "./routes/stats.js";

function isAuthorized(header: string | undefined, apiKey: string): boolean {
  if (!header) return false;
  const expected = Buffer.from(`Bearer ${apiKey}`);
  const actual = Buffer.from(header);
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

export function createApiServer() {
  const app = Fastify({ logger: false });

  app.register(cors, { origin: env.API_CORS_ORIGIN });

  app.addHook("onRequest", async (req, reply) => {
    if (!env.API_KEY || req.url === "/health") return;
    if (!isAuthorized(req.headers.authorization, env.API_KEY)) {
      reply.code(401).send({ error: "unauthorized" });
    }
  });

  app.setErrorHandler((error: FastifyError, req, reply) => {
    const statusCode = error.statusCode && error.statusCode < 500 ? error.statusCode : 500;
    logger.error("api.unhandledError", { url: req.url, method: req.method, statusCode, error: error.message });
    reply.code(statusCode).send({
      error: statusCode < 500 ? error.message : "internal_server_error",
    });
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
