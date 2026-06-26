import { z } from "zod";
import { makeRequestId } from "../../lib/requestId.js";
import { ok, fail } from "../../lib/http.js";
import { requireRole } from "../../lib/middleware.js";
import { getTenantSlug } from "../../lib/tenantSlug.js";
import { createSupabaseAdmin } from "../../lib/supabase.js";
import { makeTenantMembershipGuard } from "../../lib/security/tenantMembershipGuard.js";

const ParamsSchema = z.object({ id: z.string().uuid() });

function hoyISO() {
  return new Date().toISOString().slice(0, 10);
}

async function assertAlumnoEnTenant(admin, alumnoId, tenantId) {
  const { data, error } = await admin
    .from("academia_alumnos")
    .select("id")
    .eq("id", alumnoId)
    .eq("tenant_id", tenantId)
    .maybeSingle();
  if (error) return { ok: false, status: 500, code: "alumno_lookup_failed" };
  if (!data) return { ok: false, status: 404, code: "alumno_not_found" };
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
    return ok(reply, { archived: true, id: parsedParams.data.id }, requestId);
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
    return ok(reply, { restored: true, id: parsedParams.data.id }, requestId);
  });
}
