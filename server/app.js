import Fastify from "fastify";
import v1Routes from "./routes/v1/index.js";

export function buildApp(options = {}) {
  const app = Fastify({
    logger: true,
    ...options,
  });

  app.get("/health", async (_req, reply) => {
    return reply.code(200).send({ ok: true });
  });

  app.register(v1Routes, { prefix: "/api/v1" });

  return app;
}

export default buildApp;
