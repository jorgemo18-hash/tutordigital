import { makeRequestId } from "../../lib/requestId.js";
import { ok, fail } from "../../lib/http.js";
import { requireRole } from "../../lib/middleware.js";
import { getTenantSlug } from "../../lib/tenantSlug.js";
import { createSupabaseAdmin } from "../../lib/supabase.js";
import { makeTenantMembershipGuard } from "../../lib/security/tenantMembershipGuard.js";

// Self-service del propio alumno (rol student) — no recibe ningún id por
// parámetro, todo se deriva de su sesión (tenant + user_id), así que nunca
// puede activar el acceso de otro alumno. Llamado una vez por sesión desde
// assets/student/js/bootstrap/studentBootstrap.js al arrancar el tutor; si
// el alumno no es de academia o ya estaba activado, no hace nada (no falla).
export default async function academiaAlumnoAccesoRoutes(app) {
  const guard = makeTenantMembershipGuard();

  // PUT /api/v1/academia/alumno-acceso/activar
  app.put("/activar", { preHandler: guard.preHandler }, async (req, reply) => {
    const requestId = req.requestId || makeRequestId();
    const tenantSlug = getTenantSlug(req);
    const auth = await requireRole(req, reply, requestId, { tenantSlug, roles: ["student"] });
    if (!auth.ok) return;

    const admin = createSupabaseAdmin();
    const { data: student, error: studentErr } = await admin
      .from("students")
      .select("id")
      .eq("tenant_id", auth.tenant.id)
      .eq("user_id", auth.user.id)
      .maybeSingle();
    if (studentErr) {
      req.log.error({ err: studentErr, requestId }, "academia alumno-acceso: student lookup failed");
      return fail(reply, 500, "student_lookup_failed", "Failed to look up student", requestId);
    }
    if (!student) return ok(reply, { activated: false }, requestId);

    const { error } = await admin
      .from("academia_alumnos")
      .update({ acceso_activado: true })
      .eq("tenant_id", auth.tenant.id)
      .eq("student_id", student.id)
      .eq("acceso_activado", false);
    if (error) {
      req.log.error({ err: error, requestId }, "academia alumno-acceso: activar failed");
      return fail(reply, 500, "acceso_activar_failed", "Failed to activate acceso", requestId);
    }
    return ok(reply, { activated: true }, requestId);
  });
}
