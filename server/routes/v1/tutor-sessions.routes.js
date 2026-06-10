import { z } from "zod";
import { makeRequestId } from "../../lib/requestId.js";
import { ok, created, fail } from "../../lib/http.js";
import { rateLimit } from "../../lib/rateLimit.js";
import { requireRole } from "../../lib/middleware.js";
import { getTenantSlug } from "../../lib/tenantSlug.js";
import { createSupabaseAdmin } from "../../lib/supabase.js";
import { makeTenantMembershipGuard } from "../../lib/security/tenantMembershipGuard.js";

const PostSessionSchema = z.object({
  task_id: z.string().uuid(),
  duration_seconds: z.number().int().min(1).max(86400),
  needs_help: z.boolean().optional().default(false),
  session_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  outcome: z.enum(["completed", "abandoned", "escalated", "in_progress"]).optional(),
});

const GetSessionsSchema = z.object({
  group_id: z.string().uuid(),
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

export default async function tutorSessionsRoutes(app) {
  const tenantMembershipGuard = makeTenantMembershipGuard();

  // POST / — alumno guarda su sesión al terminar
  app.post("/", { preHandler: tenantMembershipGuard.preHandler }, async (req, reply) => {
    const requestId = req.requestId || makeRequestId();
    const tenantSlug = getTenantSlug(req);

    const auth = await requireRole(req, reply, requestId, {
      tenantSlug,
      roles: ["student"],
    });
    if (!auth.ok) return;

    const parsed = PostSessionSchema.safeParse(req.body);
    if (!parsed.success) {
      return fail(reply, 400, "invalid_body", "Invalid body", requestId, {
        issues: parsed.error.issues,
      });
    }

    const rl = await rateLimit(req, {
      limit: 60,
      windowSec: 60,
      userId: auth.user.id,
      tenantId: auth.tenant.id,
    });
    if (!rl.ok) return fail(reply, 429, "rate_limited", "Too many requests", requestId);

    const admin = createSupabaseAdmin();

    const { data: student } = await admin
      .from("students")
      .select("id")
      .eq("tenant_id", auth.tenant.id)
      .eq("user_id", auth.user.id)
      .maybeSingle();

    if (!student) {
      return fail(reply, 403, "not_student", "No student record found", requestId);
    }

    const fallbackDate = new Date().toISOString().slice(0, 10);
    const sessionDate = parsed.data.session_date || fallbackDate;

    const sessionRow = {
      student_id:       student.id,
      task_id:          parsed.data.task_id,
      tenant_id:        auth.tenant.id,
      duration_seconds: parsed.data.duration_seconds,
      needs_help:       parsed.data.needs_help,
      session_date:     sessionDate,
    };
    if (parsed.data.outcome) sessionRow.outcome = parsed.data.outcome;

    const { error } = await admin.from("tutor_sessions").insert(sessionRow);

    if (error) {
      return fail(reply, 500, "db_error", "Failed to save session", requestId);
    }

    return created(reply, { ok: true }, requestId);
  });

  // GET / — profesor obtiene sesiones de un grupo en un rango de fechas
  app.get("/", { preHandler: tenantMembershipGuard.preHandler }, async (req, reply) => {
    const requestId = req.requestId || makeRequestId();
    const tenantSlug = getTenantSlug(req);

    const auth = await requireRole(req, reply, requestId, {
      tenantSlug,
      roles: ["admin", "teacher"],
    });
    if (!auth.ok) return;

    const parsed = GetSessionsSchema.safeParse(req.query);
    if (!parsed.success) {
      return fail(reply, 400, "invalid_query", "Invalid query params", requestId, {
        issues: parsed.error.issues,
      });
    }

    const rl = await rateLimit(req, {
      limit: 60,
      windowSec: 60,
      userId: auth.user.id,
      tenantId: auth.tenant.id,
    });
    if (!rl.ok) return fail(reply, 429, "rate_limited", "Too many requests", requestId);

    const admin = createSupabaseAdmin();
    const { group_id, from, to } = parsed.data;

    const { data: students } = await admin
      .from("students")
      .select("id")
      .eq("tenant_id", auth.tenant.id)
      .eq("group_id", group_id);

    if (!students || !students.length) {
      return ok(reply, [], requestId);
    }

    const studentIds = students.map((s) => s.id);

    const { data, error } = await admin
      .from("tutor_sessions")
      .select("id, student_id, task_id, duration_seconds, needs_help, session_date, created_at, teacher_reviewed")
      .eq("tenant_id", auth.tenant.id)
      .in("student_id", studentIds)
      .gte("session_date", from)
      .lte("session_date", to);

    if (error) {
      return fail(reply, 500, "db_error", "Failed to fetch sessions", requestId);
    }

    return ok(reply, data || [], requestId);
  });

  // PATCH /:sessionId/review — profesor marca sesión como revisada (verde o naranja)
  app.patch("/:sessionId/review", { preHandler: tenantMembershipGuard.preHandler }, async (req, reply) => {
    const requestId = req.requestId || makeRequestId();
    const tenantSlug = getTenantSlug(req);

    const auth = await requireRole(req, reply, requestId, {
      tenantSlug,
      roles: ["admin", "teacher"],
    });
    if (!auth.ok) return;

    const { sessionId } = req.params;
    if (!sessionId) return fail(reply, 400, "missing_param", "Missing sessionId", requestId);

    const rl = await rateLimit(req, { limit: 60, windowSec: 60, userId: auth.user.id, tenantId: auth.tenant.id });
    if (!rl.ok) return fail(reply, 429, "rate_limited", "Too many requests", requestId);

    const admin = createSupabaseAdmin();

    const { data: sessionRow } = await admin
      .from("tutor_sessions")
      .select("student_id, task_id, session_date")
      .eq("id", sessionId)
      .eq("tenant_id", auth.tenant.id)
      .maybeSingle();

    if (!sessionRow) return fail(reply, 404, "not_found", "Session not found", requestId);

    // Marcar todas las sesiones del mismo alumno+tarea+día como revisadas
    // (cubre tanto la AI session como la end session que determina el dot)
    await admin
      .from("tutor_sessions")
      .update({ teacher_reviewed: true })
      .eq("tenant_id", auth.tenant.id)
      .eq("student_id", sessionRow.student_id)
      .eq("task_id", sessionRow.task_id)
      .eq("session_date", sessionRow.session_date);

    return ok(reply, { ok: true }, requestId);
  });

  // GET /by-task/:taskId — alumno obtiene mensajes de su sesión más reciente para una tarea
  app.get("/by-task/:taskId", { preHandler: tenantMembershipGuard.preHandler }, async (req, reply) => {
    const requestId = req.requestId || makeRequestId();
    const tenantSlug = getTenantSlug(req);

    const auth = await requireRole(req, reply, requestId, { tenantSlug, roles: ["student"] });
    if (!auth.ok) return;

    const rl = await rateLimit(req, { limit: 60, windowSec: 60, userId: auth.user.id, tenantId: auth.tenant.id });
    if (!rl.ok) return fail(reply, 429, "rate_limited", "Too many requests", requestId);

    const { taskId } = req.params;
    const admin = createSupabaseAdmin();

    const { data: student } = await admin
      .from("students")
      .select("id")
      .eq("tenant_id", auth.tenant.id)
      .eq("user_id", auth.user.id)
      .maybeSingle();
    if (!student) return fail(reply, 403, "not_student", "No student record", requestId);

    // Obtener las sesiones del alumno para esta tarea, ordenadas por fecha desc
    const { data: sessions } = await admin
      .from("tutor_sessions")
      .select("id, session_date, duration_seconds, needs_help")
      .eq("tenant_id", auth.tenant.id)
      .eq("student_id", student.id)
      .eq("task_id", taskId)
      .order("session_date", { ascending: false })
      .order("id", { ascending: false })
      .limit(20);

    if (!sessions || sessions.length === 0) {
      return ok(reply, { messages: [], session: null }, requestId);
    }

    const sessionIds = sessions.map((s) => s.id);

    const { data: messages } = await admin
      .from("session_messages")
      .select("role, content, created_at")
      .in("session_id", sessionIds)
      .order("created_at", { ascending: true })
      .limit(200);

    return ok(reply, {
      session: sessions[0],
      messages: messages || [],
    }, requestId);
  });
}
