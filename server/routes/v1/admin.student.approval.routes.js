import { z } from "zod";
import { makeRequestId } from "../../lib/requestId.js";
import { ok, fail } from "../../lib/http.js";
import { rateLimit } from "../../lib/rateLimit.js";
import { requireRole } from "../../lib/middleware.js";
import { getTenantSlug } from "../../lib/tenantSlug.js";
import { createSupabaseAdmin } from "../../lib/supabase.js";
import { makeRouteSecurity } from "../../lib/security/routeGuards.js";
import { makeTenantMembershipGuard } from "../../lib/security/tenantMembershipGuard.js";
import { getBuildInfo } from "../../lib/version.js";

// ── Schemas ────────────────────────────────────────────────────────────────

const StudentParamsSchema = z.object({
  studentId: z.string().uuid(),
});

const ApprovalActionSchema = z.object({
  action: z.enum(["approve", "reject"]),
  reason: z.string().trim().max(500).optional(),
});

// ── Routes ─────────────────────────────────────────────────────────────────

export default async function adminStudentApprovalRoutes(app) {
  const createSecurity = makeRouteSecurity({
    env: process.env,
    allowedOriginsEnv: "ALLOWED_ORIGINS",
    rateWindowMsEnv: "ADMIN_STUDENTS_RATE_WINDOW_MS",
    rateMaxEnv: "ADMIN_STUDENTS_RATE_MAX",
    routeName: "admin-student-approval",
  });
  const tenantMembershipGuard = makeTenantMembershipGuard();

  // ── GET /admin/students/pending ─ listar pendientes de aprobación ─────────
  app.get(
    "/admin/students/pending",
    { preHandler: [createSecurity.preHandler, tenantMembershipGuard.preHandler] },
    async (req, reply) => {
      const requestId = req.requestId || makeRequestId();
      const tenantSlug = getTenantSlug(req);
      const build = getBuildInfo();
      reply.header("x-ttd-version", build.label);

      const auth = await requireRole(req, reply, requestId, { tenantSlug, roles: ["admin"] });
      if (!auth.ok) return;

      const rl = await rateLimit(req, {
        limit: 60,
        windowSec: 60,
        userId: auth.user.id,
        tenantId: auth.tenant.id,
      });
      reply.header("x-ratelimit-limit", rl.limit);
      reply.header("x-ratelimit-remaining", rl.remaining);
      if (!rl.ok) return fail(reply, 429, "rate_limited", "Too many requests", requestId);

      const admin = createSupabaseAdmin();
      const { data, error } = await admin
        .from("students")
        .select("id, display_name, created_at, group_id, groups(name)")
        .eq("tenant_id", auth.tenant.id)
        .eq("approval_status", "pending")
        .order("created_at", { ascending: true });

      if (error) {
        req.log.error({ err: error, requestId }, "admin pending students fetch failed");
        return fail(reply, 500, "students_fetch_failed", "Failed to fetch pending students", requestId);
      }

      return ok(reply, { items: data || [] }, requestId);
    }
  );

  // ── PATCH /admin/students/:studentId ─ aprobar o rechazar ─────────────────
  app.patch(
    "/admin/students/:studentId",
    { preHandler: [createSecurity.preHandler, tenantMembershipGuard.preHandler] },
    async (req, reply) => {
      const requestId = req.requestId || makeRequestId();
      const tenantSlug = getTenantSlug(req);
      const build = getBuildInfo();
      reply.header("x-ttd-version", build.label);

      const auth = await requireRole(req, reply, requestId, { tenantSlug, roles: ["admin"] });
      if (!auth.ok) return;

      const parsedParams = StudentParamsSchema.safeParse(req.params || {});
      if (!parsedParams.success) {
        return fail(reply, 400, "invalid_params", "Invalid params", requestId);
      }

      const parsed = ApprovalActionSchema.safeParse(req.body || {});
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
      reply.header("x-ratelimit-limit", rl.limit);
      reply.header("x-ratelimit-remaining", rl.remaining);
      if (!rl.ok) return fail(reply, 429, "rate_limited", "Too many requests", requestId);

      const { studentId } = parsedParams.data;
      const { action, reason } = parsed.data;
      const now = new Date().toISOString();

      const updates =
        action === "approve"
          ? {
              approval_status: "approved",
              approved_at: now,
              approved_by: auth.user.id,
            }
          : {
              approval_status: "rejected",
              rejected_at: now,
              rejected_by: auth.user.id,
              rejected_reason: reason || null,
            };

      const admin = createSupabaseAdmin();
      const { data, error } = await admin
        .from("students")
        .update(updates)
        .eq("id", studentId)
        .eq("tenant_id", auth.tenant.id)
        .select("id, display_name, approval_status")
        .maybeSingle();

      if (error) {
        req.log.error({ err: error, requestId }, "admin student approval failed");
        return fail(reply, 500, "approval_failed", "Failed to update student approval", requestId);
      }
      if (!data) {
        return fail(reply, 404, "student_not_found", "Student not found", requestId);
      }

      return ok(reply, { student: data }, requestId);
    }
  );
}
