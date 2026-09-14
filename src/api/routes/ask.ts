import type { FastifyPluginAsync } from "fastify";
import { ask } from "../../ask/ask.js";

export const askRoutes: FastifyPluginAsync = async (app) => {
  app.post("/ask", async (req, reply) => {
    const { question } = req.body as { question?: string };
    if (!question) return reply.code(400).send({ error: "question is required" });
    return ask(question);
  });
};
