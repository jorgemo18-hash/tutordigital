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

    const today = new Date().toISOString().slice(0, 10);

    const { error } = await admin.from("tutor_sessions").insert({
      student_id: student.id,
      task_id: parsed.data.task_id,
      tenant_id: auth.tenant.id,
      duration_seconds: parsed.data.duration_seconds,
      needs_help: parsed.data.needs_help,
      session_date: today,
    });

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
      .select("student_id, task_id, duration_seconds, needs_help, session_date, created_at")
      .eq("tenant_id", auth.tenant.id)
      .in("student_id", studentIds)
      .gte("session_date", from)
      .lte("session_date", to);

    if (error) {
      return fail(reply, 500, "db_error", "Failed to fetch sessions", requestId);
    }

    return ok(reply, data || [], requestId);
  });
}
