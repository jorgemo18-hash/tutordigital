import { z } from "zod";
import { makeRequestId } from "../../lib/requestId.js";
import { ok, fail } from "../../lib/http.js";
import { requireRole } from "../../lib/middleware.js";
import { getTenantSlug } from "../../lib/tenantSlug.js";
import { createSupabaseAdmin } from "../../lib/supabase.js";
import { makeTenantMembershipGuard } from "../../lib/security/tenantMembershipGuard.js";
import { fetchDescuentosTipoConAsignacion, upsertAlumnoDescuentos } from "../../lib/academiaDescuentos/consultas.js";

const ParamsSchema = z.object({ alumnoId: z.string().uuid() });
const UpdateBodySchema = z.array(z.object({ descuento_tipo_id: z.string().uuid(), activo: z.boolean() }));

// Asignación de descuentos recurrentes a un alumno concreto — sección
// "DESCUENTOS RECURRENTES" del drawer de alumno. Los tipos en sí se
// gestionan en academia.descuentos-tipo.routes.js (Ajustes).
export default async function academiaAlumnosDescuentosRoutes(app) {
  const guard = makeTenantMembershipGuard();

  app.get("/:alumnoId/descuentos", { preHandler: guard.preHandler }, async (req, reply) => {
    const requestId = req.requestId || makeRequestId();
    const tenantSlug = getTenantSlug(req);
    const auth = await requireRole(req, reply, requestId, { tenantSlug, roles: ["admin"] });
    if (!auth.ok) return;

    const parsedParams = ParamsSchema.safeParse(req.params || {});
    if (!parsedParams.success) return fail(reply, 400, "invalid_params", "Invalid params", requestId);

    const admin = createSupabaseAdmin();
    const { items, error, forbidden } = await fetchDescuentosTipoConAsignacion(admin, auth.tenant.id, parsedParams.data.alumnoId);
    if (forbidden) return fail(reply, 403, "alumno_forbidden", "Alumno not found in this tenant", requestId);
    if (error) {
      req.log.error({ err: error, requestId }, "academia alumnos descuentos fetch failed");
      return fail(reply, 500, "descuentos_fetch_failed", "Failed to fetch descuentos", requestId);
    }
    return ok(reply, { descuentos: items }, requestId);
  });

  app.put("/:alumnoId/descuentos", { preHandler: guard.preHandler }, async (req, reply) => {
    const requestId = req.requestId || makeRequestId();
    const tenantSlug = getTenantSlug(req);
    const auth = await requireRole(req, reply, requestId, { tenantSlug, roles: ["admin"] });
    if (!auth.ok) return;

    const parsedParams = ParamsSchema.safeParse(req.params || {});
    if (!parsedParams.success) return fail(reply, 400, "invalid_params", "Invalid params", requestId);
    const parsed = UpdateBodySchema.safeParse(req.body || {});
    if (!parsed.success) return fail(reply, 400, "invalid_body", "Invalid body", requestId, { issues: parsed.error.issues });

    const admin = createSupabaseAdmin();
    const { error, forbidden } = await upsertAlumnoDescuentos(admin, auth.tenant.id, parsedParams.data.alumnoId, parsed.data);
    if (forbidden) return fail(reply, 403, "alumno_forbidden", "Alumno or descuento tipo not found in this tenant", requestId);
    if (error) {
      req.log.error({ err: error, requestId }, "academia alumnos descuentos update failed");
      return fail(reply, 500, "descuentos_update_failed", "Failed to update descuentos", requestId);
    }
    return ok(reply, { updated: true }, requestId);
  });
}
