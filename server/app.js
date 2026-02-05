import Fastify from "fastify";
import cors from "@fastify/cors";
import v1Routes from "./routes/v1/index.js";
import authRoutes from "./routes/v1/auth.routes.js";
import groupsRoutes from "./routes/v1/groups.routes.js";
import studentsRoutes from "./routes/v1/students.routes.js";

export async function createApp() {
  const app = Fastify({ logger: true });

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

  app.get("/health", async () => ({ ok: true }));

  app.register(authRoutes, { prefix: "/api/v1/auth" });
  app.register(groupsRoutes, { prefix: "/api/v1/groups" });
  app.register(studentsRoutes, { prefix: "/api/v1/students" });
  app.register(v1Routes, { prefix: "/api/v1" });

  return app;
}
