import { makeRequestId } from "../../lib/requestId.js";
import { ok, fail } from "../../lib/http.js";
import { rateLimit } from "../../lib/rateLimit.js";
import { requireRole } from "../../lib/middleware.js";
import { getTenantSlug } from "../../lib/tenantSlug.js";
import { createSupabaseAdmin } from "../../lib/supabase.js";
import { makeRouteSecurity } from "../../lib/security/routeGuards.js";
import { makeTenantMembershipGuard } from "../../lib/security/tenantMembershipGuard.js";
import { getBuildInfo } from "../../lib/version.js";
import { deriveUnifiedStudentList } from "../../lib/studentLifecycle.js";
import { resolveStudentEmails } from "../../lib/resolveStudentEmails.js";

// Archivo nuevo (no se añade a admin.students.routes.js, que ya está en 485
// líneas — por encima del límite de 400) para el único GET de lectura que
// necesita "Alumnos del centro": fusiona student_invites + students con
// deriveUnifiedStudentList (server/lib/studentLifecycle.js) para que cada
// persona aparezca una sola vez, en vez de las tres vistas fragmentadas
// (invitados / pendientes de aprobación / registrados) que hoy pueden
// mostrarla dos veces. Es puramente de lectura: no inserta ni actualiza nada.

export default async function adminStudentsUnifiedRoutes(app) {
  const createSecurity = makeRouteSecurity({
    env: process.env,
    allowedOriginsEnv: "ALLOWED_ORIGINS",
    rateWindowMsEnv: "ADMIN_STUDENTS_RATE_WINDOW_MS",
    rateMaxEnv: "ADMIN_STUDENTS_RATE_MAX",
    routeName: "admin-students-unified",
  });
  const tenantMembershipGuard = makeTenantMembershipGuard();

  // ── GET /admin/students/unified ─ lista unificada con estado derivado ───
  app.get(
    "/admin/students/unified",
    { preHandler: [createSecurity.preHandler, tenantMembershipGuard.preHandler] },
    async (req, reply) => {
      const requestId = req.requestId || makeRequestId();
      const tenantSlug = getTenantSlug(req);
      reply.header("x-ttd-version", getBuildInfo().label);

      const auth = await requireRole(req, reply, requestId, { tenantSlug, roles: ["admin"] });
      if (!auth.ok) return;

      const rl = await rateLimit(req, { limit: 60, windowSec: 60, userId: auth.user.id, tenantId: auth.tenant.id });
      reply.header("x-ratelimit-limit", rl.limit);
      reply.header("x-ratelimit-remaining", rl.remaining);
      if (!rl.ok) return fail(reply, 429, "rate_limited", "Too many requests", requestId);

      const admin = createSupabaseAdmin();

      const [groupsRes, invitesRes, studentsRes] = await Promise.all([
        admin.from("groups").select("id, name").eq("tenant_id", auth.tenant.id),
        admin
          .from("student_invites")
          .select("id, email, status, group_id, first_name, last_name, display_name, created_at, expires_at")
          .eq("tenant_id", auth.tenant.id)
          .order("created_at", { ascending: false })
          .limit(1000),
        admin
          .from("students")
          .select("id, user_id, group_id, display_name, first_name, last_name, approval_status, created_at, approved_at, rejected_at, rejected_reason")
          .eq("tenant_id", auth.tenant.id)
          .order("created_at", { ascending: false })
          .limit(1000),
      ]);

      if (groupsRes.error || invitesRes.error || studentsRes.error) {
        req.log.error(
          { requestId, groupsErr: groupsRes.error, invitesErr: invitesRes.error, studentsErr: studentsRes.error },
          "admin unified students fetch failed"
        );
        return fail(reply, 500, "students_fetch_failed", "Failed to fetch students", requestId);
      }

      const groupNamesById = new Map((groupsRes.data || []).map((g) => [g.id, g.name]));
      const studentsWithEmail = await resolveStudentEmails(admin, studentsRes.data || []);

      const items = deriveUnifiedStudentList({
        invites: invitesRes.data || [],
        students: studentsWithEmail,
        groupNamesById,
      });

      return ok(reply, { items, groups: groupsRes.data || [], total: items.length }, requestId);
    }
  );
}
