import { z } from "zod";
import { makeRequestId } from "../../lib/requestId.js";
import { ok, fail } from "../../lib/http.js";
import { requireRole } from "../../lib/middleware.js";
import { getTenantSlug } from "../../lib/tenantSlug.js";
import { createSupabaseAdmin } from "../../lib/supabase.js";
import { makeTenantMembershipGuard } from "../../lib/security/tenantMembershipGuard.js";
import { fetchHermanosConDescuentosActivos } from "../../lib/academiaDescuentos/consultas.js";

const ParamsSchema = z.object({ id: z.string().uuid() });

function hoyISO() {
  return new Date().toISOString().slice(0, 10);
}

async function assertAlumnoEnTenant(admin, alumnoId, tenantId) {
  const { data, error } = await admin
    .from("academia_alumnos")
    .select("id, student_id, activo, familia_id")
    .eq("id", alumnoId)
    .eq("tenant_id", tenantId)
    .maybeSingle();
  if (error) return { ok: false, status: 500, code: "alumno_lookup_failed" };
  if (!data) return { ok: false, status: 404, code: "alumno_not_found" };
  return { ok: true, alumno: data };
}

// academia_alumnos.student_id (si está enlazado) es la única vía hacia una
// cuenta real: student_id -> students.user_id -> tenant_memberships. No-op
// si no hay student_id (hoy no lo rellena ningún endpoint del alta de
// alumno, así que en la práctica esto casi siempre es un no-op — ver nota
// en el propio alumno archivado, no bloquea el archivado en sí).
async function actualizarMembershipDelAlumno(admin, studentId, tenantId, status) {
  if (!studentId) return { ok: true };
  const { data: student, error: studentErr } = await admin
    .from("students")
    .select("user_id")
    .eq("id", studentId)
    .eq("tenant_id", tenantId)
    .maybeSingle();
  if (studentErr) return { ok: false, error: studentErr };
  if (!student?.user_id) return { ok: true };

  const { error } = await admin
    .from("tenant_memberships")
    .update({ status })
    .eq("user_id", student.user_id)
    .eq("tenant_id", tenantId);
  if (error) return { ok: false, error };
  return { ok: true };
}

// Archivar/restaurar un alumno — separado de academia.alumnos.routes.js
// (registrado bajo el mismo prefijo /api/v1/academia/alumnos, mismo patrón
// que academia.alumnos.recibos-historial.routes.js) para no superar ahí
// las 400 líneas al añadir el endpoint de restaurar.
export default async function academiaAlumnosArchivarRoutes(app) {
  const guard = makeTenantMembershipGuard();

  // DELETE /api/v1/academia/alumnos/:id/archivar
  app.delete("/:id/archivar", { preHandler: guard.preHandler }, async (req, reply) => {
    const requestId = req.requestId || makeRequestId();
    const tenantSlug = getTenantSlug(req);
    const auth = await requireRole(req, reply, requestId, { tenantSlug, roles: ["admin"] });
    if (!auth.ok) return;

    const parsedParams = ParamsSchema.safeParse(req.params || {});
    if (!parsedParams.success) return fail(reply, 400, "invalid_params", "Invalid params", requestId);

    const admin = createSupabaseAdmin();
    const alumnoCheck = await assertAlumnoEnTenant(admin, parsedParams.data.id, auth.tenant.id);
    if (!alumnoCheck.ok) return fail(reply, alumnoCheck.status, alumnoCheck.code, "Alumno not found", requestId);

    const { error } = await admin
      .from("academia_alumnos")
      .update({ activo: false, fecha_baja: hoyISO() })
      .eq("id", parsedParams.data.id)
      .eq("tenant_id", auth.tenant.id);
    if (error) {
      req.log.error({ err: error, requestId }, "academia alumno archive failed");
      return fail(reply, 500, "alumno_archive_failed", "Failed to archive alumno", requestId);
    }

    const membership = await actualizarMembershipDelAlumno(admin, alumnoCheck.alumno.student_id, auth.tenant.id, "inactive");
    if (!membership.ok) {
      req.log.error({ err: membership.error, requestId }, "academia alumno archive: membership update failed");
      return fail(reply, 500, "membership_update_failed", "Alumno archived but access could not be revoked", requestId);
    }

    // Aviso no bloqueante: si el error de este cálculo fallara, no debe
    // tumbar la respuesta del archivado en sí (ya se aplicó con éxito) — se
    // devuelve la lista vacía y se loguea, sin propagar el fallo al cliente.
    const { hermanos, error: hermanosErr } = await fetchHermanosConDescuentosActivos(admin, auth.tenant.id, {
      familiaId: alumnoCheck.alumno.familia_id,
      excluirAlumnoId: parsedParams.data.id,
    });
    if (hermanosErr) req.log.error({ err: hermanosErr, requestId }, "academia alumno archive: hermanos con descuento lookup failed");

    return ok(reply, { archived: true, id: parsedParams.data.id, hermanosConDescuento: hermanos || [] }, requestId);
  });

  // PUT /api/v1/academia/alumnos/:id/restaurar — reactiva un alumno
  // archivado: activo:true, limpia fecha_baja.
  app.put("/:id/restaurar", { preHandler: guard.preHandler }, async (req, reply) => {
    const requestId = req.requestId || makeRequestId();
    const tenantSlug = getTenantSlug(req);
    const auth = await requireRole(req, reply, requestId, { tenantSlug, roles: ["admin"] });
    if (!auth.ok) return;

    const parsedParams = ParamsSchema.safeParse(req.params || {});
    if (!parsedParams.success) return fail(reply, 400, "invalid_params", "Invalid params", requestId);

    const admin = createSupabaseAdmin();
    const alumnoCheck = await assertAlumnoEnTenant(admin, parsedParams.data.id, auth.tenant.id);
    if (!alumnoCheck.ok) return fail(reply, alumnoCheck.status, alumnoCheck.code, "Alumno not found", requestId);

    const { error } = await admin
      .from("academia_alumnos")
      .update({ activo: true, fecha_baja: null })
      .eq("id", parsedParams.data.id)
      .eq("tenant_id", auth.tenant.id);
    if (error) {
      req.log.error({ err: error, requestId }, "academia alumno restore failed");
      return fail(reply, 500, "alumno_restore_failed", "Failed to restore alumno", requestId);
    }

    const membership = await actualizarMembershipDelAlumno(admin, alumnoCheck.alumno.student_id, auth.tenant.id, "active");
    if (!membership.ok) {
      req.log.error({ err: membership.error, requestId }, "academia alumno restore: membership update failed");
      return fail(reply, 500, "membership_update_failed", "Alumno restored but access could not be re-enabled", requestId);
    }

    return ok(reply, { restored: true, id: parsedParams.data.id }, requestId);
  });

  // DELETE /api/v1/academia/alumnos/:id — borrado definitivo. Solo si el
  // alumno ya está archivado (activo:false): el flujo siempre pasa primero
  // por archivar, y esto es la limpieza final desde ahí — nunca un hard
  // delete directo desde "Activos". Las tablas relacionadas (horario,
  // tarifas, descuentos, notas, sesiones) tienen ON DELETE CASCADE; los
  // recibos usan ON DELETE SET NULL para conservar el histórico fiscal.
  app.delete("/:id", { preHandler: guard.preHandler }, async (req, reply) => {
    const requestId = req.requestId || makeRequestId();
    const tenantSlug = getTenantSlug(req);
    const auth = await requireRole(req, reply, requestId, { tenantSlug, roles: ["admin"] });
    if (!auth.ok) return;

    const parsedParams = ParamsSchema.safeParse(req.params || {});
    if (!parsedParams.success) return fail(reply, 400, "invalid_params", "Invalid params", requestId);

    const admin = createSupabaseAdmin();
    const alumnoCheck = await assertAlumnoEnTenant(admin, parsedParams.data.id, auth.tenant.id);
    if (!alumnoCheck.ok) return fail(reply, alumnoCheck.status, alumnoCheck.code, "Alumno not found", requestId);
    if (alumnoCheck.alumno.activo) {
      return fail(reply, 409, "alumno_not_archived", "Solo se puede eliminar definitivamente un alumno ya archivado", requestId);
    }

    const { error } = await admin
      .from("academia_alumnos")
      .delete()
      .eq("id", parsedParams.data.id)
      .eq("tenant_id", auth.tenant.id);
    if (error) {
      req.log.error({ err: error, requestId }, "academia alumno delete failed");
      return fail(reply, 500, "alumno_delete_failed", "Failed to delete alumno", requestId);
    }

    return ok(reply, { deleted: true, id: parsedParams.data.id }, requestId);
  });
}
