import { z } from "zod";
import { makeRequestId } from "../../../lib/requestId.js";
import { ok, fail } from "../../../lib/http.js";
import { requireRole } from "../../../lib/middleware.js";
import { getTenantSlug } from "../../../lib/tenantSlug.js";
import { createSupabaseAdmin } from "../../../lib/supabase.js";
import { makeTenantMembershipGuard } from "../../../lib/security/tenantMembershipGuard.js";
import { calcularDescuento } from "../../../lib/academiaRecibos/calculos.js";
import { fetchReciboCompleto } from "../../../lib/academiaRecibos/consultas.js";

const UpdateBodySchema = z.object({
  concepto: z.string().trim().min(1).optional(),
  descuento_puntual_pct: z.number().min(0).max(100).optional(),
  descuento_puntual_nota: z.string().trim().optional().nullable(),
});
const ParamsSchema = z.object({ id: z.string().uuid() });

export default async function academiaRecibosEditarRoutes(app) {
  const guard = makeTenantMembershipGuard();

  // PUT /api/v1/academia/recibos/:id
  app.put("/:id", { preHandler: guard.preHandler }, async (req, reply) => {
    const requestId = req.requestId || makeRequestId();
    const tenantSlug = getTenantSlug(req);
    const auth = await requireRole(req, reply, requestId, { tenantSlug, roles: ["admin"] });
    if (!auth.ok) return;

    const parsedParams = ParamsSchema.safeParse(req.params || {});
    if (!parsedParams.success) return fail(reply, 400, "invalid_params", "Invalid params", requestId);
    const parsed = UpdateBodySchema.safeParse(req.body || {});
    if (!parsed.success) return fail(reply, 400, "invalid_body", "Invalid body", requestId, { issues: parsed.error.issues });

    const admin = createSupabaseAdmin();
    const tenantId = auth.tenant.id;
    const { data: recibo, error: fetchErr } = await fetchReciboCompleto(admin, tenantId, parsedParams.data.id);
    if (fetchErr) {
      req.log.error({ err: fetchErr, requestId }, "academia recibos PUT /:id: fetch failed");
      return fail(reply, 500, "recibo_fetch_failed", fetchErr.message || "Failed to fetch recibo", requestId);
    }
    if (!recibo) return fail(reply, 404, "recibo_not_found", "Recibo not found", requestId);
    if (recibo.estado !== "borrador") {
      return fail(reply, 409, "recibo_not_editable", "Solo se pueden editar recibos en borrador", requestId);
    }

    const { concepto, descuento_puntual_pct, descuento_puntual_nota } = parsed.data;
    const descuentoPuntualPct = descuento_puntual_pct ?? recibo.descuento_puntual_pct;
    // El importe de los descuentos recurrentes es un snapshot inmutable por
    // alumno (ver generarRecibo.js) — se recalcula desde las líneas en vez
    // de perderlo, que es lo que pasaba al recalcular el total solo con
    // hermanos+puntual.
    const recurrenteImporteTotal = (recibo.lineas || []).reduce(
      (suma, l) => suma + (l.descuentos_recurrentes || []).reduce((s, d) => s + Number(d.importe || 0), 0),
      0
    );
    const { totalDescuento, totalNeto } = calcularDescuento({
      totalBruto: recibo.total_bruto,
      descuentoHermanosPct: recibo.descuento_hermanos_pct,
      descuentoPuntualPct,
      descuentoRecurrenteImporte: recurrenteImporteTotal,
    });

    const fields = {
      descuento_puntual_pct: descuentoPuntualPct,
      total_descuento: totalDescuento,
      total_neto: totalNeto,
      updated_at: new Date().toISOString(),
    };
    if (concepto !== undefined) fields.concepto = concepto;
    if (descuento_puntual_nota !== undefined) fields.descuento_puntual_nota = descuento_puntual_nota;

    const { error: updateErr } = await admin
      .from("academia_recibos")
      .update(fields)
      .eq("id", recibo.id)
      .eq("tenant_id", tenantId);
    if (updateErr) {
      req.log.error({ err: updateErr, requestId }, "academia recibos PUT /:id: update failed");
      return fail(reply, 500, "recibo_update_failed", updateErr.message || "Failed to update recibo", requestId);
    }

    if (concepto !== undefined) {
      await admin.from("academia_recibos_lineas").update({ descripcion: concepto }).eq("recibo_id", recibo.id);
    }

    const { data: actualizado, error: refetchErr } = await fetchReciboCompleto(admin, tenantId, recibo.id);
    if (refetchErr) {
      req.log.error({ err: refetchErr, requestId }, "academia recibos PUT /:id: refetch failed");
      return fail(reply, 500, "recibo_fetch_failed", refetchErr.message || "Failed to fetch updated recibo", requestId);
    }
    return ok(reply, { recibo: actualizado }, requestId);
  });
}
