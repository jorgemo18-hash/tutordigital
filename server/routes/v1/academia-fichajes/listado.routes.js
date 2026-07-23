import { z } from "zod";
import { makeRequestId } from "../../../lib/requestId.js";
import { ok, fail } from "../../../lib/http.js";
import { requireRole } from "../../../lib/middleware.js";
import { getTenantSlug } from "../../../lib/tenantSlug.js";
import { createSupabaseAdmin } from "../../../lib/supabase.js";
import { makeTenantMembershipGuard } from "../../../lib/security/tenantMembershipGuard.js";
import { fetchTrabajadoresDelTenant, fetchFichajesDeTrabajador } from "../../../lib/academiaFichajes/consultas.js";

const ListadoQuerySchema = z.object({
  worker_profile_id: z.string().uuid(),
  mes: z.coerce.number().int().min(1).max(12),
  anio: z.coerce.number().int().min(2000).max(2100),
});

// Vista de gestión — solo admin: ver fichajes de CUALQUIER trabajador del
// centro (el propio trabajador solo ve los suyos, ver fichar.routes.js).
export default async function academiaFichajesListadoRoutes(app) {
  const guard = makeTenantMembershipGuard();

  // GET /api/v1/academia/fichajes/trabajadores — para el selector de la
  // vista de gestión (admin y teacher, ver migración 093/consultas.js).
  app.get("/trabajadores", { preHandler: guard.preHandler }, async (req, reply) => {
    const requestId = req.requestId || makeRequestId();
    const tenantSlug = getTenantSlug(req);
    const auth = await requireRole(req, reply, requestId, { tenantSlug, roles: ["admin"] });
    if (!auth.ok) return;

    const admin = createSupabaseAdmin();
    const { trabajadores, error } = await fetchTrabajadoresDelTenant(admin, auth.tenant.id);
    if (error) {
      req.log.error({ err: error, requestId }, "academia fichajes trabajadores failed");
      return fail(reply, 500, "trabajadores_fetch_failed", "No se pudieron cargar los trabajadores.", requestId);
    }
    return ok(reply, { trabajadores }, requestId);
  });

  // GET /api/v1/academia/fichajes?worker_profile_id=&mes=&anio= —
  // originales y correcciones del mes, ya en orden cronológico, sin
  // fusionar (ver consultas.js).
  app.get("/", { preHandler: guard.preHandler }, async (req, reply) => {
    const requestId = req.requestId || makeRequestId();
    const tenantSlug = getTenantSlug(req);
    const auth = await requireRole(req, reply, requestId, { tenantSlug, roles: ["admin"] });
    if (!auth.ok) return;

    const parsed = ListadoQuerySchema.safeParse(req.query || {});
    if (!parsed.success) return fail(reply, 400, "invalid_query", "Invalid query", requestId, { issues: parsed.error.issues });

    const admin = createSupabaseAdmin();
    const { fichajes, error } = await fetchFichajesDeTrabajador(admin, auth.tenant.id, parsed.data.worker_profile_id, {
      mes: parsed.data.mes, anio: parsed.data.anio,
    });
    if (error) {
      req.log.error({ err: error, requestId }, "academia fichajes listado failed");
      return fail(reply, 500, "fichajes_fetch_failed", "No se pudieron cargar los fichajes.", requestId);
    }
    return ok(reply, { fichajes }, requestId);
  });
}
