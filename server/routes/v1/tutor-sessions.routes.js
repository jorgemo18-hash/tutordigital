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

const PatchSessionSchema = z.object({
  outcome: z.enum(["completed", "abandoned", "escalated"]),
  duration_seconds: z.number().int().min(1).max(86400).optional(),
  needs_help: z.boolean().optional(),
});

const GetSessionsSchema = z.object({
  group_id: z.string().uuid(),
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

export default async function tutorSessionsRoutes(app) {
  const tenantMembershipGuard = makeTenantMembershipGuard();

  // POST / — alumno guarda su sesión al terminar (legado: mantener por compatibilidad)
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

  // PATCH /:sessionId — alumno actualiza outcome/duración de su sesión AI activa
  app.patch("/:sessionId", { preHandler: tenantMembershipGuard.preHandler }, async (req, reply) => {
    const requestId = req.requestId || makeRequestId();
    const tenantSlug = getTenantSlug(req);

    const auth = await requireRole(req, reply, requestId, { tenantSlug, roles: ["student"] });
    if (!auth.ok) return;

    const { sessionId } = req.params;
    if (!sessionId) return fail(reply, 400, "missing_param", "Missing sessionId", requestId);

    const parsed = PatchSessionSchema.safeParse(req.body);
    if (!parsed.success) {
      return fail(reply, 400, "invalid_body", "Invalid body", requestId, { issues: parsed.error.issues });
    }

    const rl = await rateLimit(req, { limit: 60, windowSec: 60, userId: auth.user.id, tenantId: auth.tenant.id });
    if (!rl.ok) return fail(reply, 429, "rate_limited", "Too many requests", requestId);

    const admin = createSupabaseAdmin();

    const { data: student } = await admin
      .from("students")
      .select("id")
      .eq("tenant_id", auth.tenant.id)
      .eq("user_id", auth.user.id)
      .maybeSingle();
    if (!student) return fail(reply, 403, "not_student", "No student record", requestId);

    // Verify ownership before updating
    const { data: existing } = await admin
      .from("tutor_sessions")
      .select("id, student_id")
      .eq("id", sessionId)
      .eq("tenant_id", auth.tenant.id)
      .maybeSingle();

    if (!existing) return fail(reply, 404, "not_found", "Session not found", requestId);
    if (existing.student_id !== student.id) return fail(reply, 403, "forbidden", "Not your session", requestId);

    const updates = { outcome: parsed.data.outcome };
    if (parsed.data.duration_seconds != null) updates.duration_seconds = parsed.data.duration_seconds;
    if (parsed.data.needs_help        != null) updates.needs_help        = parsed.data.needs_help;

    const { error } = await admin
      .from("tutor_sessions")
      .update(updates)
      .eq("id", sessionId);

    if (error) return fail(reply, 500, "db_error", "Failed to update session", requestId);

    return ok(reply, { ok: true }, requestId);
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

    await admin
      .from("tutor_sessions")
      .update({ teacher_reviewed: true })
      .eq("tenant_id", auth.tenant.id)
      .eq("student_id", sessionRow.student_id)
      .eq("task_id", sessionRow.task_id)
      .eq("session_date", sessionRow.session_date);

    return ok(reply, { ok: true }, requestId);
  });

  // GET /task-status/:taskId — ejercicios completados del alumno para una tarea
  app.get("/task-status/:taskId", { preHandler: tenantMembershipGuard.preHandler }, async (req, reply) => {
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

    const { data: sessions } = await admin
      .from("tutor_sessions")
      .select("exercise_index")
      .eq("tenant_id", auth.tenant.id)
      .eq("student_id", student.id)
      .eq("task_id", taskId)
      .in("outcome", ["completed", "abandoned", "escalated"]);

    const completedIndices = (sessions || [])
      .map((s) => s.exercise_index)
      .filter((i) => i != null);

    return ok(reply, { completedIndices }, requestId);
  });

  // GET /by-task/:taskId — sesiones con ejercicios del alumno para una tarea (historial L2)
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

    // Sessions with a completed outcome, ordered chronologically
    const { data: rawSessions } = await admin
      .from("tutor_sessions")
      .select("id, session_date, duration_seconds, needs_help, outcome, exercise_index, tutor_session_maps(exercises)")
      .eq("tenant_id", auth.tenant.id)
      .eq("student_id", student.id)
      .eq("task_id", taskId)
      .in("outcome", ["completed", "abandoned", "escalated"])
      .order("created_at", { ascending: true })
      .limit(50);

    const sessions = (rawSessions || []).map((s) => {
      const exList  = Array.isArray(s.tutor_session_maps?.exercises) ? s.tutor_session_maps.exercises : [];
      const exEntry = exList.find((e) => e.index === s.exercise_index) || null;
      return {
        id:               s.id,
        session_date:     s.session_date,
        duration_seconds: s.duration_seconds,
        needs_help:       s.needs_help,
        outcome:          s.outcome,
        exercise_index:   s.exercise_index,
        exercise_title:   exEntry?.title || null,
      };
    });

    return ok(reply, { sessions }, requestId);
  });

  // GET /:sessionId/messages — mensajes de una sesión concreta (historial L3)
  app.get("/:sessionId/messages", { preHandler: tenantMembershipGuard.preHandler }, async (req, reply) => {
    const requestId = req.requestId || makeRequestId();
    const tenantSlug = getTenantSlug(req);

    const auth = await requireRole(req, reply, requestId, { tenantSlug, roles: ["student"] });
    if (!auth.ok) return;

    const rl = await rateLimit(req, { limit: 60, windowSec: 60, userId: auth.user.id, tenantId: auth.tenant.id });
    if (!rl.ok) return fail(reply, 429, "rate_limited", "Too many requests", requestId);

    const { sessionId } = req.params;
    const admin = createSupabaseAdmin();

    const { data: student } = await admin
      .from("students")
      .select("id")
      .eq("tenant_id", auth.tenant.id)
      .eq("user_id", auth.user.id)
      .maybeSingle();
    if (!student) return fail(reply, 403, "not_student", "No student record", requestId);

    // Verify ownership
    const { data: session } = await admin
      .from("tutor_sessions")
      .select("id, student_id")
      .eq("id", sessionId)
      .eq("tenant_id", auth.tenant.id)
      .maybeSingle();

    if (!session) return fail(reply, 404, "not_found", "Session not found", requestId);
    if (session.student_id !== student.id) return fail(reply, 403, "forbidden", "Not your session", requestId);

    const { data: messages } = await admin
      .from("session_messages")
      .select("role, content, created_at")
      .eq("session_id", sessionId)
      .order("created_at", { ascending: true })
      .limit(300);

    return ok(reply, { messages: messages || [] }, requestId);
  });
}
