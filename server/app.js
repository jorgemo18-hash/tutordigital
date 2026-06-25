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
import adminStudentsRoutes from "./routes/v1/admin.students.routes.js";
import adminStudentApprovalRoutes from "./routes/v1/admin.student.approval.routes.js";
import teacherInviteRoutes from "./routes/v1/teacher.invites.routes.js";
import studentRegisterRoutes from "./routes/v1/student.register.routes.js";
import studentInviteRoutes from "./routes/v1/student.invite.routes.js";
import buildRoutes from "./routes/v1/build.routes.js";
import attachmentsRoutes from "./routes/v1/attachments.routes.js";
import superadminRoutes from "./routes/v1/superadmin.routes.js";
import superadminTrashRoutes from "./routes/v1/superadmin.trash.routes.js";
import superadminStatsRoutes from "./routes/v1/superadmin.stats.routes.js";
import superadminTenantPeopleRoutes from "./routes/v1/superadmin.tenant.people.routes.js";
import supportRoutes from "./routes/v1/support.routes.js";
import tutorSessionsRoutes from "./routes/v1/tutor-sessions.routes.js";
import sessionRoutes from "./routes/v1/session.routes.js";
import gradesRoutes from "./routes/v1/grades.routes.js";
import reportsRoutes from "./routes/v1/reports.routes.js";
import subjectsRoutes from "./routes/v1/subjects.routes.js";
import gradeWeightsRoutes from "./routes/v1/grade-weights.routes.js";
import adminDashboardRoutes from "./routes/v1/admin.dashboard.routes.js";
import studentNotesRoutes from "./routes/v1/student-notes.routes.js";
import termDatesRoutes from "./routes/v1/term-dates.routes.js";
import publicOnboardingRoutes from "./routes/v1/public.onboarding.routes.js";
import academiaHorarioRoutes from "./routes/v1/academia.horario.routes.js";
import academiaSesionesRoutes from "./routes/v1/academia.sesiones.routes.js";
import academiaConfigRoutes from "./routes/v1/academia.config.routes.js";
import academiaNotasExamenRoutes from "./routes/v1/academia.notas-examen.routes.js";
import academiaAlumnosRoutes from "./routes/v1/academia.alumnos.routes.js";
import academiaFamiliasRoutes from "./routes/v1/academia.familias.routes.js";
import academiaInscripcionesRoutes from "./routes/v1/academia.inscripciones.routes.js";
import { makeRequestId } from "./lib/requestId.js";
import { ok } from "./lib/http.js";
import { getTenantSlug } from "./lib/tenantSlug.js";
import { getAllowedOrigins, matchesAllowedOrigin } from "./lib/security/origins.js";
import { Sentry } from "./lib/sentry.js";

export async function createApp() {
  const app = Fastify({ logger: true });
  const allowedOrigins = getAllowedOrigins({
    env: process.env,
    envNames: ["ALLOWED_ORIGINS", "CHAT_ALLOWED_ORIGINS"],
  });

  await app.register(cors, {
    origin: (origin, cb) => {
      if (!origin) return cb(null, true);
      if (matchesAllowedOrigin(origin, allowedOrigins)) return cb(null, true);
      return cb(null, false);
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
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

  app.addHook("onError", (req, reply, error, done) => {
    console.error(
      "[fastify:onError]",
      "requestId=" + (req.requestId || "?"),
      "url=" + (req.url || "?"),
      "error=" + error?.message,
      "\n" + (error?.stack || "")
    );
    Sentry.captureException(error, {
      extra: { requestId: req.requestId, url: req.url, method: req.method },
    });
    done();
  });

  app.addHook("onResponse", (req, reply, done) => {
    const tenantSlug = req.tenantSlug || getTenantSlug(req) || "";
    const url = req.raw?.url || req.url || "";
    const method = req.raw?.method || req.method || "";
    const status = reply.statusCode;
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
    if (url.includes("/api/v1/")) {
      req.log.info({ method, url, status }, "api response");
    }
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
  app.register(adminStudentsRoutes, { prefix: "/api/v1" });
  app.register(adminStudentApprovalRoutes, { prefix: "/api/v1" });
  app.register(studentRegisterRoutes, { prefix: "/api/v1" });
  app.register(studentInviteRoutes,   { prefix: "/api/v1" });
  app.register(buildRoutes, { prefix: "/api/v1" });
  app.register(chatRoutes, { prefix: "/api/v1/chat" });
  app.register(attachmentsRoutes, { prefix: "/api/v1/attachments" });
  app.register(accessRoutes, { prefix: "/api/v1" });
  app.register(superadminRoutes, { prefix: "/api/v1" });
  app.register(superadminTrashRoutes, { prefix: "/api/v1" });
  app.register(superadminStatsRoutes, { prefix: "/api/v1" });
  app.register(superadminTenantPeopleRoutes, { prefix: "/api/v1" });
  app.register(supportRoutes, { prefix: "/api/v1" });
  app.register(tutorSessionsRoutes, { prefix: "/api/v1/tutor-sessions" });
  app.register(sessionRoutes,       { prefix: "/api/v1/session" });
  app.register(gradesRoutes, { prefix: "/api/v1/grades" });
  app.register(studentNotesRoutes, { prefix: "/api/v1/student-notes" });
  app.register(reportsRoutes, { prefix: "/api/v1/reports" });
  app.register(subjectsRoutes, { prefix: "/api/v1/subjects" });
  app.register(gradeWeightsRoutes, { prefix: "/api/v1/grade-weights" });
  app.register(adminDashboardRoutes, { prefix: "/api/v1" });
  app.register(termDatesRoutes, { prefix: "/api/v1/term-dates" });
  app.register(publicOnboardingRoutes, { prefix: "/api/v1" });
  app.register(academiaHorarioRoutes, { prefix: "/api/v1/academia/horario" });
  app.register(academiaSesionesRoutes, { prefix: "/api/v1/academia/sesiones" });
  app.register(academiaConfigRoutes, { prefix: "/api/v1/academia/config" });
  app.register(academiaNotasExamenRoutes, { prefix: "/api/v1/academia/notas-examen" });
  app.register(academiaAlumnosRoutes, { prefix: "/api/v1/academia/alumnos" });
  app.register(academiaFamiliasRoutes, { prefix: "/api/v1/academia/familias" });
  app.register(academiaInscripcionesRoutes, { prefix: "/api/v1/academia/inscripciones" });
  app.register(v1Routes, { prefix: "/api/v1" });

  return app;
}
