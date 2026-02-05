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

  await app.register(cors, {
    origin: (origin, cb) => {
      // Permitir requests sin Origin (curl/health checks)
      if (!origin) return cb(null, true);

      // PERMITIR SOLO ESTE ORIGIN (Vercel)
      if (origin === "https://tutordigital-rosy.vercel.app") return cb(null, true);

      // Bloquear el resto
      return cb(new Error("CORS blocked"), false);
    },
    methods: ["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "X-Request-Id"],
  });

  app.register(v1Routes, { prefix: "/api/v1" });

  return app;
}

export default buildApp;
