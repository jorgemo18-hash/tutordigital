import { z } from "zod";
import { makeRequestId } from "../../lib/requestId.js";
import { ok, fail } from "../../lib/http.js";
import { requireRole } from "../../lib/middleware.js";
import { getTenantSlug } from "../../lib/tenantSlug.js";
import { createSupabaseAdmin } from "../../lib/supabase.js";
import { makeTenantMembershipGuard } from "../../lib/security/tenantMembershipGuard.js";

const ParamsSchema = z.object({ id: z.string().uuid() });

async function fetchStudentEnTenant(admin, studentId, tenantId) {
  const { data, error } = await admin
    .from("students")
    .select("id, user_id")
    .eq("id", studentId)
    .eq("tenant_id", tenantId)
    .maybeSingle();
  if (error) return { ok: false, status: 500, code: "student_lookup_failed" };
  if (!data) return { ok: false, status: 404, code: "student_not_found" };
  return { ok: true, student: data };
}

// A diferencia de academia (donde archivar solo toca una tabla), aquí el
// alumno SÍ tiene sesión propia en auth.users vía tenant_memberships (ver
// server/lib/tenant.js: resolveTenantForUser exige membership.status ===
// "active" para cualquier acceso) — sin esto, archivar no revocaría el
// acceso real. No-op si el alumno no tiene user_id (invitación aceptada
// pero sin cuenta vinculada todavía).
async function actualizarMembership(admin, userId, tenantId, status) {
  if (!userId) return { ok: true };
  const { error } = await admin
    .from("tenant_memberships")
    .update({ status })
    .eq("user_id", userId)
    .eq("tenant_id", tenantId);
  if (error) return { ok: false, error };
  return { ok: true };
}

// Archivar/restaurar un alumno de un centro standalone/integrado — separado
// de admin.students.routes.js (485 líneas, ya por encima del límite) para no
// crecerlo más, mismo patrón que academia.alumnos.archivar.routes.js.
export default async function adminStudentsArchivarRoutes(app) {
  const guard = makeTenantMembershipGuard();

  // DELETE /api/v1/admin/students/:id/archive
  app.delete("/:id/archive", { preHandler: guard.preHandler }, async (req, reply) => {
    const requestId = req.requestId || makeRequestId();
    const tenantSlug = getTenantSlug(req);
    const auth = await requireRole(req, reply, requestId, { tenantSlug, roles: ["admin"] });
    if (!auth.ok) return;

    const parsedParams = ParamsSchema.safeParse(req.params || {});
    if (!parsedParams.success) return fail(reply, 400, "invalid_params", "Invalid params", requestId);

    const admin = createSupabaseAdmin();
    const lookup = await fetchStudentEnTenant(admin, parsedParams.data.id, auth.tenant.id);
    if (!lookup.ok) return fail(reply, lookup.status, lookup.code, "Student not found", requestId);

    const { error } = await admin
      .from("students")
      .update({ approval_status: "archived" })
      .eq("id", parsedParams.data.id)
      .eq("tenant_id", auth.tenant.id);
    if (error) {
      req.log.error({ err: error, requestId }, "admin student archive failed");
      return fail(reply, 500, "student_archive_failed", "Failed to archive student", requestId);
    }

    const membership = await actualizarMembership(admin, lookup.student.user_id, auth.tenant.id, "inactive");
    if (!membership.ok) {
      req.log.error({ err: membership.error, requestId }, "admin student archive: membership update failed");
      return fail(reply, 500, "membership_update_failed", "Student archived but access could not be revoked", requestId);
    }

    return ok(reply, { archived: true, id: parsedParams.data.id }, requestId);
  });

  // PUT /api/v1/admin/students/:id/restore
  app.put("/:id/restore", { preHandler: guard.preHandler }, async (req, reply) => {
    const requestId = req.requestId || makeRequestId();
    const tenantSlug = getTenantSlug(req);
    const auth = await requireRole(req, reply, requestId, { tenantSlug, roles: ["admin"] });
    if (!auth.ok) return;

    const parsedParams = ParamsSchema.safeParse(req.params || {});
    if (!parsedParams.success) return fail(reply, 400, "invalid_params", "Invalid params", requestId);

    const admin = createSupabaseAdmin();
    const lookup = await fetchStudentEnTenant(admin, parsedParams.data.id, auth.tenant.id);
    if (!lookup.ok) return fail(reply, lookup.status, lookup.code, "Student not found", requestId);

    const { error } = await admin
      .from("students")
      .update({ approval_status: "approved" })
      .eq("id", parsedParams.data.id)
      .eq("tenant_id", auth.tenant.id);
    if (error) {
      req.log.error({ err: error, requestId }, "admin student restore failed");
      return fail(reply, 500, "student_restore_failed", "Failed to restore student", requestId);
    }

    const membership = await actualizarMembership(admin, lookup.student.user_id, auth.tenant.id, "active");
    if (!membership.ok) {
      req.log.error({ err: membership.error, requestId }, "admin student restore: membership update failed");
      return fail(reply, 500, "membership_update_failed", "Student restored but access could not be re-enabled", requestId);
    }

    return ok(reply, { restored: true, id: parsedParams.data.id }, requestId);
  });
}
