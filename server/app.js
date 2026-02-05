import Fastify from "fastify";
import cors from "@fastify/cors";
import v1Routes from "./routes/v1/index.js";

export function buildApp(options = {}) {
  const app = Fastify({
    logger: true,
    ...options,
  });

  app.get("/health", async (_req, reply) => {
    return reply.code(200).send({ ok: true });
  });

  const allowedOrigins = (process.env.CORS_ORIGINS || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  await app.register(cors, {
    origin: (origin, cb) => {
      if (!origin) return cb(null, true);
      if (allowedOrigins.includes(origin)) return cb(null, true);
      return cb(new Error("CORS blocked"), false);
    },
    methods: ["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "X-Request-Id"],
  });

  app.register(v1Routes, { prefix: "/api/v1" });

  return app;
}

export default buildApp;
