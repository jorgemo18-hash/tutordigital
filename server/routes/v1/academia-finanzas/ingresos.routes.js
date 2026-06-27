import { z } from "zod";
import { makeRequestId } from "../../../lib/requestId.js";
import { ok, fail } from "../../../lib/http.js";
import { requireRole } from "../../../lib/middleware.js";
import { getTenantSlug } from "../../../lib/tenantSlug.js";
import { createSupabaseAdmin } from "../../../lib/supabase.js";
import { makeTenantMembershipGuard } from "../../../lib/security/tenantMembershipGuard.js";
import { fetchPendientesAgrupados, fetchGridIngresos } from "../../../lib/academiaFinanzas/ingresosConsultas.js";

const MesAnioQuerySchema = z.object({
  mes: z.coerce.number().int().min(1).max(12),
  anio: z.coerce.number().int().min(2000).max(2100),
});

async function autorizarYParsearMesAnio(req, reply, requestId) {
  const tenantSlug = getTenantSlug(req);
  const auth = await requireRole(req, reply, requestId, { tenantSlug, roles: ["admin"] });
  if (!auth.ok) return { ok: false };

  const parsed = MesAnioQuerySchema.safeParse(req.query || {});
  if (!parsed.success) {
    fail(reply, 400, "invalid_query", "Invalid query", requestId, { issues: parsed.error.issues });
    return { ok: false };
  }
  return { ok: true, tenantId: auth.tenant.id, mes: parsed.data.mes, anio: parsed.data.anio };
}

// Datos de la pestaña Ingresos: "Pendientes" (recibos del mes agrupados
// por método de pago) e "Historial" (grid anual por alumno, reutilizando
// /grid con el curso académico que contiene el mes/año pedidos).
export default async function academiaFinanzasIngresosRoutes(app) {
  const guard = makeTenantMembershipGuard();

  // GET /api/v1/academia/finanzas/ingresos/pendientes?mes=&anio=
  app.get("/pendientes", { preHandler: guard.preHandler }, async (req, reply) => {
    const requestId = req.requestId || makeRequestId();
    const auth = await autorizarYParsearMesAnio(req, reply, requestId);
    if (!auth.ok) return;

    const admin = createSupabaseAdmin();
    const { grupos, error } = await fetchPendientesAgrupados(admin, auth.tenantId, { mes: auth.mes, anio: auth.anio });
    if (error) {
      req.log.error({ err: error, requestId }, "academia finanzas ingresos pendientes failed");
      return fail(reply, 500, "ingresos_pendientes_failed", "Failed to fetch pendientes", requestId);
    }
    return ok(reply, { grupos }, requestId);
  });

  // GET /api/v1/academia/finanzas/ingresos/grid?mes=&anio=
  app.get("/grid", { preHandler: guard.preHandler }, async (req, reply) => {
    const requestId = req.requestId || makeRequestId();
    const auth = await autorizarYParsearMesAnio(req, reply, requestId);
    if (!auth.ok) return;

    const admin = createSupabaseAdmin();
    const { filas, error } = await fetchGridIngresos(admin, auth.tenantId, { mes: auth.mes, anio: auth.anio });
    if (error) {
      req.log.error({ err: error, requestId }, "academia finanzas ingresos grid failed");
      return fail(reply, 500, "ingresos_grid_failed", "Failed to fetch grid", requestId);
    }
    return ok(reply, { filas }, requestId);
  });
}
