import { z } from "zod";
import { makeRequestId } from "../../../lib/requestId.js";
import { ok, fail } from "../../../lib/http.js";
import { requireRole } from "../../../lib/middleware.js";
import { getTenantSlug } from "../../../lib/tenantSlug.js";
import { createSupabaseAdmin } from "../../../lib/supabase.js";
import { makeTenantMembershipGuard } from "../../../lib/security/tenantMembershipGuard.js";
import { fetchReciboCompleto } from "../../../lib/academiaRecibos/consultas.js";
import { buildListItem, fetchListadoDelEnvio } from "../../../lib/academiaEnvio/listadoDelEnvio.js";
import { fetchMesesEnviados } from "../../../lib/academiaRecibos/mesesEnviados.js";

const MesAnioQuerySchema = z.object({
  mes: z.coerce.number().int().min(1).max(12),
  anio: z.coerce.number().int().min(2000).max(2100),
});
const AnioQuerySchema = z.object({
  anio: z.coerce.number().int().min(2000).max(2100),
});
const ParamsSchema = z.object({ id: z.string().uuid() });

// buildListItem vive con el resto del listado en
// lib/academiaEnvio/listadoDelEnvio.js; se reexporta porque los tests del
// viaje ruta -> pantalla la importan desde aquí.
export { buildListItem };

// GET/listado de recibos: por período, por id, y meses con enviados de un año.
export default async function academiaRecibosListadoRoutes(app) {
  const guard = makeTenantMembershipGuard();

  // GET /api/v1/academia/recibos?mes=&anio=
  app.get("/", { preHandler: guard.preHandler }, async (req, reply) => {
    const requestId = req.requestId || makeRequestId();
    const tenantSlug = getTenantSlug(req);
    const auth = await requireRole(req, reply, requestId, { tenantSlug, roles: ["admin"] });
    if (!auth.ok) return;

    const parsed = MesAnioQuerySchema.safeParse(req.query || {});
    if (!parsed.success) return fail(reply, 400, "invalid_query", "Invalid query", requestId, { issues: parsed.error.issues });
    const { mes, anio } = parsed.data;

    const admin = createSupabaseAdmin();
    const { lista, periodoInforme, error } = await fetchListadoDelEnvio(admin, auth.tenant.id, { mes, anio }, {
      logWarn: (obj, msg) => req.log.warn({ ...obj, requestId }, msg),
    });
    if (error) {
      req.log.error({ err: error, requestId }, "academia recibos list failed");
      return fail(reply, 500, "recibos_fetch_failed", "Failed to fetch recibos", requestId);
    }
    return ok(reply, { recibos: lista, periodo_informe: periodoInforme }, requestId);
  });

  // GET /api/v1/academia/recibos/meses-enviados?anio= — para marcar en el
  // selector de mes los que ya tienen al menos un recibo enviado ese año.
  app.get("/meses-enviados", { preHandler: guard.preHandler }, async (req, reply) => {
    const requestId = req.requestId || makeRequestId();
    const tenantSlug = getTenantSlug(req);
    const auth = await requireRole(req, reply, requestId, { tenantSlug, roles: ["admin"] });
    if (!auth.ok) return;

    const parsed = AnioQuerySchema.safeParse(req.query || {});
    if (!parsed.success) return fail(reply, 400, "invalid_query", "Invalid query", requestId, { issues: parsed.error.issues });

    const admin = createSupabaseAdmin();
    const { meses, error } = await fetchMesesEnviados(admin, auth.tenant.id, parsed.data.anio);
    if (error) {
      req.log.error({ err: error, requestId }, "academia recibos meses-enviados failed");
      return fail(reply, 500, "meses_fetch_failed", "Failed to fetch meses enviados", requestId);
    }
    return ok(reply, { meses }, requestId);
  });

  // GET /api/v1/academia/recibos/:id — detalle completo (líneas incluidas)
  // para la vista previa del panel "Envío a familias".
  app.get("/:id", { preHandler: guard.preHandler }, async (req, reply) => {
    const requestId = req.requestId || makeRequestId();
    const tenantSlug = getTenantSlug(req);
    const auth = await requireRole(req, reply, requestId, { tenantSlug, roles: ["admin"] });
    if (!auth.ok) return;

    const parsedParams = ParamsSchema.safeParse(req.params || {});
    if (!parsedParams.success) return fail(reply, 400, "invalid_params", "Invalid params", requestId);

    const admin = createSupabaseAdmin();
    const { data: recibo, error } = await fetchReciboCompleto(admin, auth.tenant.id, parsedParams.data.id);
    if (error) {
      req.log.error({ err: error, requestId }, "academia recibos GET /:id failed");
      return fail(reply, 500, "recibo_fetch_failed", error.message || "Failed to fetch recibo", requestId);
    }
    if (!recibo) return fail(reply, 404, "recibo_not_found", "Recibo not found", requestId);
    return ok(reply, { recibo }, requestId);
  });
}
