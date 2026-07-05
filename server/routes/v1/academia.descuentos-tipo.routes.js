import { z } from "zod";
import { makeRequestId } from "../../lib/requestId.js";
import { ok, created, fail } from "../../lib/http.js";
import { requireRole } from "../../lib/middleware.js";
import { getTenantSlug } from "../../lib/tenantSlug.js";
import { createSupabaseAdmin } from "../../lib/supabase.js";
import { makeTenantMembershipGuard } from "../../lib/security/tenantMembershipGuard.js";
import { contarAsignacionesActivas } from "../../lib/academiaDescuentos/consultas.js";

const DescuentoTipoSchema = z.object({
  concepto: z.string().trim().min(1),
  porcentaje: z.number().gt(0).max(100),
  acumulable: z.boolean().optional().default(true),
  intervalo: z.enum(["primer_mes", "primer_trimestre", "siempre"]),
});
const ParamsSchema = z.object({ id: z.string().uuid() });
const SELECT_COLS = "id, concepto, porcentaje, acumulable, intervalo";

// CRUD de tipos de descuento recurrente configurables por tenant (p.ej.
// "Pago anticipado 5%", tarjeta "Descuentos recurrentes" en Ajustes). Se
// asignan luego por alumno en academia.alumnos.descuentos.routes.js y se
// aplican al generar recibos (server/lib/academiaRecibos/generarRecibo.js).
export default async function academiaDescuentosTipoRoutes(app) {
  const guard = makeTenantMembershipGuard();

  app.get("/", { preHandler: guard.preHandler }, async (req, reply) => {
    const requestId = req.requestId || makeRequestId();
    const tenantSlug = getTenantSlug(req);
    const auth = await requireRole(req, reply, requestId, { tenantSlug, roles: ["admin"] });
    if (!auth.ok) return;

    const admin = createSupabaseAdmin();
    const { data, error } = await admin
      .from("academia_descuentos_tipo")
      .select(SELECT_COLS)
      .eq("tenant_id", auth.tenant.id)
      .order("concepto", { ascending: true });
    if (error) {
      req.log.error({ err: error, requestId }, "academia descuentos-tipo fetch failed");
      return fail(reply, 500, "descuentos_tipo_fetch_failed", "Failed to fetch descuentos tipo", requestId);
    }
    return ok(reply, { descuentos: data || [] }, requestId);
  });

  app.post("/", { preHandler: guard.preHandler }, async (req, reply) => {
    const requestId = req.requestId || makeRequestId();
    const tenantSlug = getTenantSlug(req);
    const auth = await requireRole(req, reply, requestId, { tenantSlug, roles: ["admin"] });
    if (!auth.ok) return;

    const parsed = DescuentoTipoSchema.safeParse(req.body || {});
    if (!parsed.success) return fail(reply, 400, "invalid_body", "Invalid body", requestId, { issues: parsed.error.issues });

    const admin = createSupabaseAdmin();
    const { data, error } = await admin
      .from("academia_descuentos_tipo")
      .insert({ tenant_id: auth.tenant.id, ...parsed.data })
      .select(SELECT_COLS)
      .single();
    if (error) {
      req.log.error({ err: error, requestId }, "academia descuentos-tipo create failed");
      return fail(reply, 500, "descuento_tipo_create_failed", "Failed to create descuento tipo", requestId);
    }
    return created(reply, { descuento: data }, requestId);
  });

  app.put("/:id", { preHandler: guard.preHandler }, async (req, reply) => {
    const requestId = req.requestId || makeRequestId();
    const tenantSlug = getTenantSlug(req);
    const auth = await requireRole(req, reply, requestId, { tenantSlug, roles: ["admin"] });
    if (!auth.ok) return;

    const parsedParams = ParamsSchema.safeParse(req.params || {});
    if (!parsedParams.success) return fail(reply, 400, "invalid_params", "Invalid params", requestId);
    const parsed = DescuentoTipoSchema.safeParse(req.body || {});
    if (!parsed.success) return fail(reply, 400, "invalid_body", "Invalid body", requestId, { issues: parsed.error.issues });

    const admin = createSupabaseAdmin();
    const { data, error } = await admin
      .from("academia_descuentos_tipo")
      .update(parsed.data)
      .eq("id", parsedParams.data.id)
      .eq("tenant_id", auth.tenant.id)
      .select(SELECT_COLS)
      .maybeSingle();
    if (error) {
      req.log.error({ err: error, requestId }, "academia descuentos-tipo update failed");
      return fail(reply, 500, "descuento_tipo_update_failed", "Failed to update descuento tipo", requestId);
    }
    if (!data) return fail(reply, 404, "descuento_tipo_not_found", "Descuento tipo not found", requestId);
    return ok(reply, { descuento: data }, requestId);
  });

  // Solo si ningún alumno lo tiene activo — si lo tiene, 409 con cuántos.
  app.delete("/:id", { preHandler: guard.preHandler }, async (req, reply) => {
    const requestId = req.requestId || makeRequestId();
    const tenantSlug = getTenantSlug(req);
    const auth = await requireRole(req, reply, requestId, { tenantSlug, roles: ["admin"] });
    if (!auth.ok) return;

    const parsedParams = ParamsSchema.safeParse(req.params || {});
    if (!parsedParams.success) return fail(reply, 400, "invalid_params", "Invalid params", requestId);

    const admin = createSupabaseAdmin();
    const { count, error: countErr, forbidden } = await contarAsignacionesActivas(admin, auth.tenant.id, parsedParams.data.id);
    if (forbidden) return fail(reply, 404, "descuento_tipo_not_found", "Descuento tipo not found", requestId);
    if (countErr) {
      req.log.error({ err: countErr, requestId }, "academia descuentos-tipo delete: count failed");
      return fail(reply, 500, "descuento_tipo_delete_failed", "Failed to check assignments", requestId);
    }
    if (count > 0) {
      return fail(
        reply, 409, "descuento_tipo_en_uso",
        `Hay ${count} alumno(s) con este descuento activo — desactívalo antes de eliminarlo.`,
        requestId
      );
    }

    const { error } = await admin
      .from("academia_descuentos_tipo")
      .delete()
      .eq("id", parsedParams.data.id)
      .eq("tenant_id", auth.tenant.id);
    if (error) {
      req.log.error({ err: error, requestId }, "academia descuentos-tipo delete failed");
      return fail(reply, 500, "descuento_tipo_delete_failed", "Failed to delete descuento tipo", requestId);
    }
    return ok(reply, { deleted: true }, requestId);
  });
}
