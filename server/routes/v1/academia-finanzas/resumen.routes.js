import { z } from "zod";
import { makeRequestId } from "../../../lib/requestId.js";
import { ok, fail } from "../../../lib/http.js";
import { requireRole } from "../../../lib/middleware.js";
import { getTenantSlug } from "../../../lib/tenantSlug.js";
import { createSupabaseAdmin } from "../../../lib/supabase.js";
import { makeTenantMembershipGuard } from "../../../lib/security/tenantMembershipGuard.js";
import { fetchResumenMensual, fetchResumenFiscal } from "../../../lib/academiaFinanzas/resumenConsultas.js";

const AnioQuerySchema = z.object({ anio: z.coerce.number().int().min(2000).max(2100) });

async function autorizarYParsearAnio(req, reply, requestId) {
  const tenantSlug = getTenantSlug(req);
  const auth = await requireRole(req, reply, requestId, { tenantSlug, roles: ["admin"] });
  if (!auth.ok) return { ok: false };

  const parsed = AnioQuerySchema.safeParse(req.query || {});
  if (!parsed.success) {
    fail(reply, 400, "invalid_query", "Invalid query", requestId, { issues: parsed.error.issues });
    return { ok: false };
  }
  return { ok: true, tenantId: auth.tenant.id, anio: parsed.data.anio };
}

// Datos de la pestaña Resumen — año fiscal/calendario (ver
// academiaFinanzas/resumenConsultas.js para la diferencia con el curso
// académico que usa la pestaña Ingresos).
export default async function academiaFinanzasResumenRoutes(app) {
  const guard = makeTenantMembershipGuard();

  // GET /api/v1/academia/finanzas/resumen/mensual?anio=
  app.get("/mensual", { preHandler: guard.preHandler }, async (req, reply) => {
    const requestId = req.requestId || makeRequestId();
    const auth = await autorizarYParsearAnio(req, reply, requestId);
    if (!auth.ok) return;

    const admin = createSupabaseAdmin();
    const { meses, error } = await fetchResumenMensual(admin, auth.tenantId, auth.anio);
    if (error) {
      req.log.error({ err: error, requestId }, "academia finanzas resumen mensual failed");
      return fail(reply, 500, "resumen_mensual_failed", "Failed to fetch resumen mensual", requestId);
    }
    return ok(reply, { meses }, requestId);
  });

  // GET /api/v1/academia/finanzas/resumen/fiscal?anio=
  app.get("/fiscal", { preHandler: guard.preHandler }, async (req, reply) => {
    const requestId = req.requestId || makeRequestId();
    const auth = await autorizarYParsearAnio(req, reply, requestId);
    if (!auth.ok) return;

    const admin = createSupabaseAdmin();
    const { fiscal, error } = await fetchResumenFiscal(admin, auth.tenantId, auth.anio);
    if (error) {
      req.log.error({ err: error, requestId }, "academia finanzas resumen fiscal failed");
      return fail(reply, 500, "resumen_fiscal_failed", "Failed to fetch resumen fiscal", requestId);
    }
    return ok(reply, { fiscal }, requestId);
  });
}
