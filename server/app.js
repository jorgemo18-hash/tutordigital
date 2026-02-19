import Fastify from "fastify";
import cors from "@fastify/cors";
import v1Routes from "./routes/v1/index.js";
import authRoutes from "./routes/v1/auth.routes.js";
import groupsRoutes from "./routes/v1/groups.routes.js";
import studentsRoutes from "./routes/v1/students.routes.js";
import tasksRoutes from "./routes/v1/tasks.routes.js";
import ticketsRoutes from "./routes/v1/tickets.routes.js";
import notebookRoutes from "./routes/v1/notebook.routes.js";
import chatRoutes from "./routes/v1/chat.routes.js";
import teacherRequestsRoutes from "./routes/v1/teacher.requests.routes.js";
import accessRoutes from "./routes/v1/access.routes.js";
import adminTeachersRoutes from "./routes/v1/admin.teachers.routes.js";
import adminGroupsRoutes from "./routes/v1/admin.groups.routes.js";
import teacherInviteRoutes from "./routes/v1/teacher.invites.routes.js";
import buildRoutes from "./routes/v1/build.routes.js";
import { makeRequestId } from "./lib/requestId.js";
import { ok } from "./lib/http.js";
import { getTenantSlug } from "./lib/tenantSlug.js";

export async function createApp() {
  const app = Fastify({ logger: true });

  await app.register(cors, {
    origin: (origin, cb) => {
      // Permitir requests sin Origin (curl/health checks)
      if (!origin) return cb(null, true);

      // PERMITIR SOLO ESTE ORIGIN (Vercel)
      if (origin === "https://tutordigital-rosy.vercel.app") return cb(null, true);

      // Permitir previews de Vercel para este proyecto
      if (origin.endsWith(".vercel.app")) return cb(null, true);

      // Permitir localhost en dev
      if (process.env.NODE_ENV !== "production") {
        if (origin.startsWith("http://localhost") || origin.startsWith("http://127.0.0.1")) {
          return cb(null, true);
        }
      }

      // Bloquear el resto
      return cb(new Error("CORS blocked"), false);
    },
    credentials: true,
    methods: ["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: [
      "content-type",
      "authorization",
      "x-ttd-tenant",
      "x-tenant-slug",
      "x-request-id",
      "x-client-request-id",
    ],
    exposedHeaders: [
      "x-request-id",
      "x-ratelimit-limit",
      "x-ratelimit-remaining",
      "x-ratelimit-reset",
    ],
  });

  app.addHook("onRequest", (req, reply, done) => {
    if (req.method === "OPTIONS") {
      const incoming = String(req.headers["x-request-id"] || "").trim();
      const requestId = incoming || makeRequestId();
      req.requestId = requestId;
      reply.header("x-request-id", requestId);
      app.log.info(
        { method: req.method, path: req.url, requestId },
        "preflight: onRequest reached"
      );
      done();
      return;
    }
    const incoming = String(req.headers["x-request-id"] || "").trim();
    const requestId = incoming || makeRequestId();
    req.requestId = requestId;
    reply.header("x-request-id", requestId);
    done();
  });

  app.addHook("onResponse", (req, reply, done) => {
    const tenantSlug = req.tenantSlug || getTenantSlug(req) || "";
    app.log.info(
      {
        method: req.method,
        path: req.url,
        status: reply.statusCode,
        requestId: req.requestId,
        tenantSlug,
        userId: req.userId || "",
      },
      "request"
    );
    done();
  });

  app.get("/health", async (req, reply) => ok(reply, { ok: true }, req.requestId));

  app.register(authRoutes, { prefix: "/api/v1/auth" });
  app.register(groupsRoutes, { prefix: "/api/v1/groups" });
  app.register(studentsRoutes, { prefix: "/api/v1/students" });
  app.register(tasksRoutes, { prefix: "/api/v1/tasks" });
  app.register(ticketsRoutes, { prefix: "/api/v1/tickets" });
  app.register(notebookRoutes, { prefix: "/api/v1/notebook" });
  app.register(teacherRequestsRoutes, { prefix: "/api/v1/teacher/requests" });
  app.register(teacherInviteRoutes, { prefix: "/api/v1/teacher" });
  app.register(adminTeachersRoutes, { prefix: "/api/v1" });
  app.register(adminGroupsRoutes, { prefix: "/api/v1" });
  app.register(buildRoutes, { prefix: "/api/v1" });
  app.register(chatRoutes, { prefix: "/api/v1/chat" });
  app.register(accessRoutes, { prefix: "/api/v1" });
  app.register(v1Routes, { prefix: "/api/v1" });

  return app;
}
