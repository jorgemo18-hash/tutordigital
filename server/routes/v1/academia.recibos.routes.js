import { z } from "zod";
import { makeRequestId } from "../../lib/requestId.js";
import { ok, created, fail } from "../../lib/http.js";
import { requireRole } from "../../lib/middleware.js";
import { getTenantSlug } from "../../lib/tenantSlug.js";
import { createSupabaseAdmin } from "../../lib/supabase.js";
import { makeTenantMembershipGuard } from "../../lib/security/tenantMembershipGuard.js";
import {
  formatearConcepto,
  calcularDescuento,
  siguienteNumeroRecibo,
  fetchFamiliasConAlumnos,
  fetchRecibosDelMes,
  fetchReciboCompleto,
  enviarReciboPorId,
} from "../../lib/academiaRecibosHelpers.js";

const MesAnioQuerySchema = z.object({
  mes: z.coerce.number().int().min(1).max(12),
  anio: z.coerce.number().int().min(2000).max(2100),
});

const GenerarBodySchema = z.object({
  mes: z.number().int().min(1).max(12),
  anio: z.number().int().min(2000).max(2100),
});

const UpdateBodySchema = z.object({
  concepto: z.string().trim().min(1).optional(),
  descuento_puntual_pct: z.number().min(0).max(100).optional(),
  descuento_puntual_nota: z.string().trim().optional().nullable(),
});

const ParamsSchema = z.object({ id: z.string().uuid() });

async function fetchConfig(admin, tenantId) {
  const { data } = await admin
    .from("academia_config")
    .select("nombre_emisor, direccion_emisor, email_emisor, concepto_recibo_plantilla, texto_exencion_iva, descuento_hermanos_pct")
    .eq("tenant_id", tenantId)
    .maybeSingle();
  return data || {};
}

function buildListItem({ familia, alumnosActivos, recibo }) {
  return {
    familia_id: familia.id,
    familia_nombre: familia.nombre,
    familia_email: familia.email,
    familia_metodo_pago: familia.metodo_pago,
    recibo: recibo
      ? { id: recibo.id, estado: recibo.estado, total_neto: recibo.total_neto, fecha_envio: recibo.fecha_envio }
      : null,
    alumnos_activos: alumnosActivos,
    tiene_hermanos: alumnosActivos.length > 1,
  };
}

export default async function academiaRecibosRoutes(app) {
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
    const [{ items, error: itemsErr }, { porFamilia, error: recibosErr }] = await Promise.all([
      fetchFamiliasConAlumnos(admin, auth.tenant.id),
      fetchRecibosDelMes(admin, auth.tenant.id, { mes, anio }),
    ]);
    if (itemsErr || recibosErr) {
      req.log.error({ err: itemsErr || recibosErr, requestId }, "academia recibos list failed");
      return fail(reply, 500, "recibos_fetch_failed", "Failed to fetch recibos", requestId);
    }

    const lista = items.map((item) => buildListItem({ ...item, recibo: porFamilia[item.familia.id] || null }));
    return ok(reply, { recibos: lista }, requestId);
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

  // POST /api/v1/academia/recibos/generar
  app.post("/generar", { preHandler: guard.preHandler }, async (req, reply) => {
    const requestId = req.requestId || makeRequestId();
    const tenantSlug = getTenantSlug(req);
    const auth = await requireRole(req, reply, requestId, { tenantSlug, roles: ["admin"] });
    if (!auth.ok) return;

    const parsed = GenerarBodySchema.safeParse(req.body || {});
    if (!parsed.success) return fail(reply, 400, "invalid_body", "Invalid body", requestId, { issues: parsed.error.issues });
    const { mes, anio } = parsed.data;

    const admin = createSupabaseAdmin();
    const tenantId = auth.tenant.id;
    const [{ items, error: itemsErr }, { porFamilia, error: recibosErr }, config] = await Promise.all([
      fetchFamiliasConAlumnos(admin, tenantId),
      fetchRecibosDelMes(admin, tenantId, { mes, anio }),
      fetchConfig(admin, tenantId),
    ]);
    if (itemsErr || recibosErr) {
      req.log.error({ err: itemsErr || recibosErr, requestId }, "academia recibos generar: fetch failed");
      return fail(reply, 500, "recibos_fetch_failed", "Failed to fetch data for generar", requestId);
    }

    const concepto = formatearConcepto(config.concepto_recibo_plantilla, mes, anio, config.nombre_emisor || auth.tenant.name);
    let generados = 0;

    for (const { familia, alumnosActivos } of items) {
      if (!alumnosActivos.length) continue;
      if (porFamilia[familia.id]) continue;

      const totalBruto = alumnosActivos.reduce((sum, a) => sum + Number(a.precio_bruto || 0), 0);
      const descuentoHermanosPct = alumnosActivos.length >= 2 ? Number(config.descuento_hermanos_pct || 0) : 0;
      const { totalDescuento, totalNeto } = calcularDescuento({ totalBruto, descuentoHermanosPct, descuentoPuntualPct: 0 });

      const { numero, error: numeroErr } = await siguienteNumeroRecibo(admin, tenantId, anio);
      if (numeroErr) {
        req.log.error({ err: numeroErr, requestId }, "academia recibos generar: numero failed");
        continue;
      }

      const { data: recibo, error: insertErr } = await admin
        .from("academia_recibos")
        .insert({
          tenant_id: tenantId,
          familia_id: familia.id,
          mes,
          anio,
          numero_recibo: numero,
          concepto,
          descuento_hermanos_pct: descuentoHermanosPct,
          descuento_puntual_pct: 0,
          total_bruto: totalBruto,
          total_descuento: totalDescuento,
          total_neto: totalNeto,
        })
        .select("id")
        .single();
      if (insertErr) {
        req.log.error({ err: insertErr, requestId }, "academia recibos generar: insert recibo failed");
        continue;
      }

      const lineas = alumnosActivos.map((a) => ({
        recibo_id: recibo.id,
        alumno_id: a.id,
        nombre_alumno: a.nombre,
        curso_alumno: a.curso,
        precio_bruto: a.precio_bruto,
        descripcion: concepto,
      }));
      const { error: lineasErr } = await admin.from("academia_recibos_lineas").insert(lineas);
      if (lineasErr) {
        req.log.error({ err: lineasErr, requestId }, "academia recibos generar: insert lineas failed");
        continue;
      }
      generados += 1;
    }

    return created(reply, { generados }, requestId);
  });

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
    const { totalDescuento, totalNeto } = calcularDescuento({
      totalBruto: recibo.total_bruto,
      descuentoHermanosPct: recibo.descuento_hermanos_pct,
      descuentoPuntualPct,
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

  // POST /api/v1/academia/recibos/:id/enviar
  app.post("/:id/enviar", { preHandler: guard.preHandler }, async (req, reply) => {
    const requestId = req.requestId || makeRequestId();
    const tenantSlug = getTenantSlug(req);
    const auth = await requireRole(req, reply, requestId, { tenantSlug, roles: ["admin"] });
    if (!auth.ok) return;

    const parsedParams = ParamsSchema.safeParse(req.params || {});
    if (!parsedParams.success) return fail(reply, 400, "invalid_params", "Invalid params", requestId);

    const admin = createSupabaseAdmin();
    const tenantId = auth.tenant.id;
    const config = await fetchConfig(admin, tenantId);
    const resultado = await enviarReciboPorId(admin, {
      tenantId,
      reciboId: parsedParams.data.id,
      tenantNombre: auth.tenant.name,
      config,
    });

    if (!resultado.ok) {
      if (resultado.code === "not_found") return fail(reply, 404, "recibo_not_found", resultado.motivo, requestId);
      if (resultado.code === "sin_email") return fail(reply, 422, "familia_sin_email", resultado.motivo, requestId);
      req.log.error({ err: resultado, requestId }, "academia recibos enviar failed");
      return fail(reply, 500, "recibo_enviar_failed", resultado.motivo, requestId);
    }
    return ok(reply, { enviado: true }, requestId);
  });

  // POST /api/v1/academia/recibos/enviar-todos?mes=&anio=
  app.post("/enviar-todos", { preHandler: guard.preHandler }, async (req, reply) => {
    const requestId = req.requestId || makeRequestId();
    const tenantSlug = getTenantSlug(req);
    const auth = await requireRole(req, reply, requestId, { tenantSlug, roles: ["admin"] });
    if (!auth.ok) return;

    const parsed = MesAnioQuerySchema.safeParse(req.query || {});
    if (!parsed.success) return fail(reply, 400, "invalid_query", "Invalid query", requestId, { issues: parsed.error.issues });
    const { mes, anio } = parsed.data;

    const admin = createSupabaseAdmin();
    const tenantId = auth.tenant.id;
    const { data: borradores, error: borradoresErr } = await admin
      .from("academia_recibos")
      .select("id")
      .eq("tenant_id", tenantId)
      .eq("mes", mes)
      .eq("anio", anio)
      .eq("estado", "borrador");
    if (borradoresErr) {
      req.log.error({ err: borradoresErr, requestId }, "academia recibos enviar-todos: fetch failed");
      return fail(reply, 500, "recibos_fetch_failed", "Failed to fetch borradores", requestId);
    }

    const config = await fetchConfig(admin, tenantId);
    let enviados = 0;
    const errores = [];
    for (const { id } of borradores || []) {
      const resultado = await enviarReciboPorId(admin, { tenantId, reciboId: id, tenantNombre: auth.tenant.name, config });
      if (resultado.ok) enviados += 1;
      else errores.push({ familia_nombre: resultado.familiaNombre || "", motivo: resultado.motivo });
    }

    return ok(reply, { enviados, errores }, requestId);
  });
}
