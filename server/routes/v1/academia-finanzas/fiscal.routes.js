import { z } from "zod";
import { makeRequestId } from "../../../lib/requestId.js";
import { ok, fail } from "../../../lib/http.js";
import { requireRole } from "../../../lib/middleware.js";
import { getTenantSlug } from "../../../lib/tenantSlug.js";
import { createSupabaseAdmin } from "../../../lib/supabase.js";
import { makeTenantMembershipGuard } from "../../../lib/security/tenantMembershipGuard.js";
import { fetchModelo130, fetchAlquilerBaseMensual, fetchNominasAnio } from "../../../lib/academiaFinanzas/fiscalConsultas.js";

const AnioTrimestreQuerySchema = z.object({
  anio: z.coerce.number().int().min(2000).max(2100),
  trimestre: z.coerce.number().int().min(1).max(4),
});

async function autorizarYParsearPeriodo(req, reply, requestId) {
  const tenantSlug = getTenantSlug(req);
  const auth = await requireRole(req, reply, requestId, { tenantSlug, roles: ["admin"] });
  if (!auth.ok) return { ok: false };

  const parsed = AnioTrimestreQuerySchema.safeParse(req.query || {});
  if (!parsed.success) {
    fail(reply, 400, "invalid_query", "Invalid query", requestId, { issues: parsed.error.issues });
    return { ok: false };
  }
  return { ok: true, tenantId: auth.tenant.id, anio: parsed.data.anio, trimestre: parsed.data.trimestre };
}

// Pestaña Fiscal (Modelo 130/115/111) — todos los cálculos son del lado
// del cliente, estos endpoints solo entregan los datos crudos que no
// puede conocer el frontend por sí solo (ingresos/gastos del trimestre, y
// los valores editables guardados en academia_config).
export default async function academiaFinanzasFiscalRoutes(app) {
  const guard = makeTenantMembershipGuard();

  // GET /api/v1/academia/finanzas/fiscal/130?anio=&trimestre=
  app.get("/130", { preHandler: guard.preHandler }, async (req, reply) => {
    const requestId = req.requestId || makeRequestId();
    const auth = await autorizarYParsearPeriodo(req, reply, requestId);
    if (!auth.ok) return;

    const admin = createSupabaseAdmin();
    const { modelo130, error } = await fetchModelo130(admin, auth.tenantId, { anio: auth.anio, trimestre: auth.trimestre });
    if (error) {
      req.log.error({ err: error, requestId }, "academia finanzas fiscal 130 failed");
      return fail(reply, 500, "fiscal_130_failed", "Failed to fetch modelo 130", requestId);
    }
    return ok(reply, { modelo130 }, requestId);
  });

  // GET /api/v1/academia/finanzas/fiscal/115?anio=&trimestre=
  app.get("/115", { preHandler: guard.preHandler }, async (req, reply) => {
    const requestId = req.requestId || makeRequestId();
    const auth = await autorizarYParsearPeriodo(req, reply, requestId);
    if (!auth.ok) return;

    const admin = createSupabaseAdmin();
    const { alquiler_base_mensual, error } = await fetchAlquilerBaseMensual(admin, auth.tenantId);
    if (error) {
      req.log.error({ err: error, requestId }, "academia finanzas fiscal 115 failed");
      return fail(reply, 500, "fiscal_115_failed", "Failed to fetch modelo 115", requestId);
    }
    return ok(reply, { alquiler_base_mensual }, requestId);
  });

  // GET /api/v1/academia/finanzas/fiscal/111?anio=&trimestre=
  app.get("/111", { preHandler: guard.preHandler }, async (req, reply) => {
    const requestId = req.requestId || makeRequestId();
    const auth = await autorizarYParsearPeriodo(req, reply, requestId);
    if (!auth.ok) return;

    const admin = createSupabaseAdmin();
    const { trimestres, nominas_config, error } = await fetchNominasAnio(admin, auth.tenantId, auth.anio);
    if (error) {
      req.log.error({ err: error, requestId }, "academia finanzas fiscal 111 failed");
      return fail(reply, 500, "fiscal_111_failed", "Failed to fetch modelo 111", requestId);
    }
    return ok(reply, { trimestres, nominas_config }, requestId);
  });
}
