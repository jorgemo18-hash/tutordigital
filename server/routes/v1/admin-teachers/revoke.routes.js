import { makeRequestId } from "../../../lib/requestId.js";
import { ok, fail } from "../../../lib/http.js";
import { requireRole } from "../../../lib/middleware.js";
import { getTenantSlug } from "../../../lib/tenantSlug.js";
import { createSupabaseAdmin } from "../../../lib/supabase.js";
import { makeRouteSecurity } from "../../../lib/security/routeGuards.js";
import { makeTenantMembershipGuard } from "../../../lib/security/tenantMembershipGuard.js";
import { RevokeParamsSchema } from "../../../lib/adminTeacherHelpers.js";

// POST /admin/teachers/teacher-invites/:id/revoke — extraído de
// admin.teachers.routes.js. Genérico por tenant_id, sin nada específico
// de instituto — reutilizable tal cual desde el panel de academia.
export default async function adminTeachersRevokeRoutes(app) {
  const createSecurity = makeRouteSecurity({
    env: process.env,
    allowedOriginsEnv: "ALLOWED_ORIGINS",
    rateWindowMsEnv: "ADMIN_TEACHERS_RATE_WINDOW_MS",
    rateMaxEnv: "ADMIN_TEACHERS_RATE_MAX",
    routeName: "admin-teachers",
  });
  const tenantMembershipGuard = makeTenantMembershipGuard();

  app.post(
    "/admin/teachers/teacher-invites/:id/revoke",
    { preHandler: [createSecurity.preHandler, tenantMembershipGuard.preHandler] },
    async (req, reply) => {
      const requestId = req.requestId || makeRequestId();
      const tenantSlug = getTenantSlug(req);

      const auth = await requireRole(req, reply, requestId, {
        tenantSlug,
        roles: ["admin"],
      });
      if (!auth.ok) return;

      const parsedParams = RevokeParamsSchema.safeParse(req.params || {});
      if (!parsedParams.success) {
        return fail(reply, 400, "invalid_params", "Invalid params", requestId, {
          issues: parsedParams.error.issues,
        });
      }

      const admin = createSupabaseAdmin();
      const { data, error } = await admin
        .from("teacher_invites")
        .update({ status: "revoked" })
        .eq("id", parsedParams.data.id)
        .eq("tenant_id", auth.tenant.id)
        .eq("status", "pending")
        .select("id, status")
        .maybeSingle();

      if (error) {
        return fail(reply, 500, "teacher_invite_revoke_failed", "Failed to revoke invite", requestId);
      }
      if (!data) {
        return fail(reply, 404, "teacher_invite_not_found", "Invite not found", requestId);
      }

      return ok(reply, data, requestId);
    }
  );
}
