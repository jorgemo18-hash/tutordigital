import { z } from "zod";
import { makeRequestId } from "../../lib/requestId.js";
import { ok, fail } from "../../lib/http.js";
import { requireRole } from "../../lib/middleware.js";
import { getTenantSlug } from "../../lib/tenantSlug.js";
import { createSupabaseAdmin } from "../../lib/supabase.js";
import { makeTenantMembershipGuard } from "../../lib/security/tenantMembershipGuard.js";
import { fetchHistorialReciboAlumno } from "../../lib/academiaRecibos/historialAlumno.js";

const ParamsSchema = z.object({ alumnoId: z.string().uuid() });

// GET /api/v1/academia/alumnos/:alumnoId/recibos-historial — recibos
// históricos de un alumno (vía academia_recibos_lineas.alumno_id), para la
// sección "Historial de recibos" del drawer de alumno.
export default async function academiaAlumnosRecibosHistorialRoutes(app) {
  const guard = makeTenantMembershipGuard();

  app.get("/:alumnoId/recibos-historial", { preHandler: guard.preHandler }, async (req, reply) => {
    const requestId = req.requestId || makeRequestId();
    const tenantSlug = getTenantSlug(req);
    const auth = await requireRole(req, reply, requestId, { tenantSlug, roles: ["admin"] });
    if (!auth.ok) return;

    const parsedParams = ParamsSchema.safeParse(req.params || {});
    if (!parsedParams.success) return fail(reply, 400, "invalid_params", "Invalid params", requestId);

    const admin = createSupabaseAdmin();
    const { historial, error } = await fetchHistorialReciboAlumno(admin, auth.tenant.id, parsedParams.data.alumnoId);
    if (error) {
      req.log.error({ err: error, requestId }, "academia alumnos recibos-historial failed");
      return fail(reply, 500, "historial_fetch_failed", "Failed to fetch historial", requestId);
    }
    return ok(reply, { historial }, requestId);
  });
}
