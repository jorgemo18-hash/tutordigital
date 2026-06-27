import { z } from "zod";
import { makeRequestId } from "../../../lib/requestId.js";
import { ok, fail } from "../../../lib/http.js";
import { requireRole } from "../../../lib/middleware.js";
import { getTenantSlug } from "../../../lib/tenantSlug.js";
import { createSupabaseAdmin } from "../../../lib/supabase.js";
import { makeTenantMembershipGuard } from "../../../lib/security/tenantMembershipGuard.js";
import { fetchConfig } from "../../../lib/academiaRecibos/consultas.js";
import { marcarReciboPagado, marcarReciboPendiente } from "../../../lib/academiaRecibos/marcarPago.js";
import { fetchTextosLegalesActivosPorTipo } from "../../../lib/academiaTextosLegales/consultas.js";

const ParamsSchema = z.object({ id: z.string().uuid() });

export default async function academiaRecibosMarcarPagoRoutes(app) {
  const guard = makeTenantMembershipGuard();

  // PUT /api/v1/academia/recibos/:id/marcar-pagado
  app.put("/:id/marcar-pagado", { preHandler: guard.preHandler }, async (req, reply) => {
    const requestId = req.requestId || makeRequestId();
    const tenantSlug = getTenantSlug(req);
    const auth = await requireRole(req, reply, requestId, { tenantSlug, roles: ["admin"] });
    if (!auth.ok) return;

    const parsedParams = ParamsSchema.safeParse(req.params || {});
    if (!parsedParams.success) return fail(reply, 400, "invalid_params", "Invalid params", requestId);

    const admin = createSupabaseAdmin();
    const tenantId = auth.tenant.id;
    const config = await fetchConfig(admin, tenantId);
    const textosLopd = await fetchTextosLegalesActivosPorTipo(admin, tenantId, "email");
    const textosExencion = await fetchTextosLegalesActivosPorTipo(admin, tenantId, "recibos");

    const resultado = await marcarReciboPagado(admin, {
      tenantId, reciboId: parsedParams.data.id, tenantNombre: auth.tenant.name, config, textosLopd, textosExencion,
    });
    if (!resultado.ok) {
      req.log.error({ err: resultado, requestId }, "academia recibos marcar-pagado failed");
      return fail(reply, 500, "marcar_pagado_failed", resultado.motivo, requestId);
    }
    return ok(reply, { ok: true }, requestId);
  });

  // PUT /api/v1/academia/recibos/:id/marcar-pendiente
  app.put("/:id/marcar-pendiente", { preHandler: guard.preHandler }, async (req, reply) => {
    const requestId = req.requestId || makeRequestId();
    const tenantSlug = getTenantSlug(req);
    const auth = await requireRole(req, reply, requestId, { tenantSlug, roles: ["admin"] });
    if (!auth.ok) return;

    const parsedParams = ParamsSchema.safeParse(req.params || {});
    if (!parsedParams.success) return fail(reply, 400, "invalid_params", "Invalid params", requestId);

    const admin = createSupabaseAdmin();
    const resultado = await marcarReciboPendiente(admin, { tenantId: auth.tenant.id, reciboId: parsedParams.data.id });
    if (!resultado.ok) {
      req.log.error({ err: resultado, requestId }, "academia recibos marcar-pendiente failed");
      return fail(reply, 500, "marcar_pendiente_failed", resultado.motivo, requestId);
    }
    return ok(reply, { ok: true }, requestId);
  });
}
