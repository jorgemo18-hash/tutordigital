import { makeRequestId } from "../../lib/requestId.js";
import { ok, fail } from "../../lib/http.js";
import { rateLimit } from "../../lib/rateLimit.js";
import { requireRole } from "../../lib/middleware.js";
import { getTenantSlug } from "../../lib/tenantSlug.js";
import { createSupabaseAdmin } from "../../lib/supabase.js";
import { makeTenantMembershipGuard } from "../../lib/security/tenantMembershipGuard.js";

export default async function adminDashboardRoutes(app) {
  const tenantMembershipGuard = makeTenantMembershipGuard();

  // GET /admin/dashboard — resumen de métricas y actividad de hoy
  app.get(
    "/admin/dashboard",
    { preHandler: tenantMembershipGuard.preHandler },
    async (req, reply) => {
      const requestId = req.requestId || makeRequestId();
      const tenantSlug = getTenantSlug(req);

      const auth = await requireRole(req, reply, requestId, { tenantSlug, roles: ["admin"] });
      if (!auth.ok) return;

      const rl = await rateLimit(req, {
        limit: 60,
        windowSec: 60,
        userId: auth.user.id,
        tenantId: auth.tenant.id,
      });
      if (!rl.ok) return fail(reply, 429, "rate_limited", "Too many requests", requestId);

      const admin = createSupabaseAdmin();
      const tenantId = auth.tenant.id;
      const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD (UTC)
      const todayStart = today + "T00:00:00.000Z";

      const [groupsRes, studentsRes, teachersRes, sessionsRes, teacherActivityRes] =
        await Promise.all([
          admin
            .from("groups")
            .select("id", { count: "exact", head: true })
            .eq("tenant_id", tenantId),

          admin
            .from("students")
            .select("id, approval_status")
            .eq("tenant_id", tenantId),

          admin
            .from("teacher_profiles")
            .select("id", { count: "exact", head: true })
            .eq("tenant_id", tenantId)
            .eq("is_active", true),

          admin
            .from("tutor_sessions")
            .select("student_id")
            .eq("tenant_id", tenantId)
            .eq("session_date", today),

          admin
            .from("teacher_profiles")
            .select("id", { count: "exact", head: true })
            .eq("tenant_id", tenantId)
            .gte("last_seen_at", todayStart),
        ]);

      if (groupsRes.error || studentsRes.error || teachersRes.error) {
        req.log.error({ requestId }, "admin dashboard query failed");
        return fail(reply, 500, "db_error", "Failed to fetch dashboard data", requestId);
      }

      const students = studentsRes.data || [];
      const studentsActive  = students.filter((s) => s.approval_status === "approved").length;
      const studentsPending = students.filter((s) => s.approval_status === "pending").length;

      const uniqueStudentsToday = new Set(
        (sessionsRes.data || []).map((s) => s.student_id)
      ).size;

      return ok(
        reply,
        {
          groups_count:     groupsRes.count    ?? 0,
          students_active:  studentsActive,
          students_pending: studentsPending,
          teachers_count:   teachersRes.count  ?? 0,
          activity_today: {
            students: uniqueStudentsToday,
            teachers: teacherActivityRes.count ?? 0,
          },
        },
        requestId
      );
    }
  );
}
