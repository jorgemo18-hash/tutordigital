import { z } from "zod";
import { makeRequestId } from "../../lib/requestId.js";
import { ok, fail } from "../../lib/http.js";
import { requireRole } from "../../lib/middleware.js";
import { getTenantSlug } from "../../lib/tenantSlug.js";
import { createSupabaseAdmin } from "../../lib/supabase.js";
import { makeTenantMembershipGuard } from "../../lib/security/tenantMembershipGuard.js";
import { fetchEconomicoFamilia } from "../../lib/academiaRecibos/economicoFamilia.js";

const ParamsSchema = z.object({ familiaId: z.string().uuid() });

// GET /api/v1/academia/familias/:familiaId/economico — foto económica
// ESTIMADA de la familia (tarifa + descuentos recurrentes vigentes, mes/año
// actuales), para el bloque "Familia — foto económica" del drawer de
// alumno. Se clava por familiaId (no por alumnoId) para que el drawer
// pueda pedir la de la familia recién elegida en el selector aunque
// todavía no se haya guardado — ver el comentario en economicoFamilia.js.
// Archivo aparte de academia.familias.routes.js, mismo patrón que el resto
// de sub-rutas de academia (una responsabilidad por archivo).
export default async function academiaFamiliasEconomicoRoutes(app) {
  const guard = makeTenantMembershipGuard();

  app.get("/:familiaId/economico", { preHandler: guard.preHandler }, async (req, reply) => {
    const requestId = req.requestId || makeRequestId();
    const tenantSlug = getTenantSlug(req);
    const auth = await requireRole(req, reply, requestId, { tenantSlug, roles: ["admin"] });
    if (!auth.ok) return;

    const parsedParams = ParamsSchema.safeParse(req.params || {});
    if (!parsedParams.success) return fail(reply, 400, "invalid_params", "Invalid params", requestId);

    const admin = createSupabaseAdmin();
    const { data, error } = await fetchEconomicoFamilia(admin, auth.tenant.id, parsedParams.data.familiaId);
    if (error) {
      req.log.error({ err: error, requestId }, "academia familias economico failed");
      return fail(reply, 500, "economico_fetch_failed", "Failed to fetch economico familia", requestId);
    }
    if (!data) return fail(reply, 404, "familia_not_found", "Familia not found", requestId);
    return ok(reply, data, requestId);
  });
}
