import { z } from "zod";
import { makeRequestId } from "../../../lib/requestId.js";
import { ok, created, fail } from "../../../lib/http.js";
import { requireRole } from "../../../lib/middleware.js";
import { getTenantSlug } from "../../../lib/tenantSlug.js";
import { createSupabaseAdmin } from "../../../lib/supabase.js";
import { makeTenantMembershipGuard } from "../../../lib/security/tenantMembershipGuard.js";
import { formatearConcepto } from "../../../lib/academiaRecibos/calculos.js";
import { fetchFamiliasConAlumnos, fetchRecibosDelMes, fetchConfig } from "../../../lib/academiaRecibos/consultas.js";
import { generarReciboParaFamilia, eliminarRecibo } from "../../../lib/academiaRecibos/generarRecibo.js";
import { evaluarConfirmacionRecibos } from "../../../lib/academiaRecibos/confirmacionRegenerar.js";
import { fetchDescuentosActivosPorAlumno } from "../../../lib/academiaDescuentos/consultas.js";

const PeriodoBodySchema = z.object({
  mes: z.number().int().min(1).max(12),
  anio: z.number().int().min(2000).max(2100),
  confirmar: z.boolean().optional().default(false),
  // Solo lo usa POST /generar, para crear el recibo de UNA familia
  // concreta (vista individual sin recibo aún) sin generar de paso el
  // resto del mes — ver soloFamiliaIds en generarParaFamiliasSinRecibo.
  familia_id: z.string().uuid().optional(),
});
const ParamsSchema = z.object({ id: z.string().uuid() });
const ConfirmarBodySchema = z.object({ confirmar: z.boolean().optional().default(false) });

// Genera un recibo por cada familia con alumnos activos del período que
// todavía no tenga uno. `soloFamiliaIds` (opcional) acota la generación a
// un subconjunto — solo lo usa /:id/regenerar tras borrar un recibo
// concreto, para no generar de paso recibos nuevos de otras familias que
// no se pidieron. /regenerar (regenera todo el período) y /generar no lo
// pasan a propósito: deben alcanzar a cualquier familia activa sin recibo.
// `previoPorFamilia` (familia_id -> {numero_recibo, descuento_puntual_pct,
// descuento_puntual_nota}) trae los datos del recibo que el llamador acaba
// de borrar para esa familia (si había uno) — así ni el ajuste manual ni el
// número de recibo se pierden solo por regenerar. `log` es req.log de quien llama, para el
// resumen de inserts fallidos.
async function generarParaFamiliasSinRecibo(admin, {
  tenantId, tenantNombre, mes, anio, soloFamiliaIds, previoPorFamilia = {}, log,
} = {}) {
  const [{ items, error: itemsErr }, { porFamilia, error: recibosErr }, config] = await Promise.all([
    fetchFamiliasConAlumnos(admin, tenantId),
    fetchRecibosDelMes(admin, tenantId, { mes, anio }),
    fetchConfig(admin, tenantId),
  ]);
  if (itemsErr || recibosErr) return { error: itemsErr || recibosErr };

  const alumnoIds = items.flatMap(({ alumnosActivos }) => alumnosActivos.map((a) => a.id));
  const { porAlumno: descuentosPorAlumno, error: descErr } = await fetchDescuentosActivosPorAlumno(admin, tenantId, alumnoIds);
  if (descErr) return { error: descErr };

  const concepto = formatearConcepto(config.concepto_recibo_plantilla, mes, anio, config.nombre_emisor || tenantNombre);
  let generados = 0;
  const errores = [];
  const reciboIdsPorFamilia = {};

  for (const { familia, alumnosActivos } of items) {
    if (soloFamiliaIds && !soloFamiliaIds.has(familia.id)) continue;
    if (!alumnosActivos.length) continue;
    if (porFamilia[familia.id]) continue;

    const previo = previoPorFamilia[familia.id];
    const { ok: insertOk, error: insertErr, reciboId } = await generarReciboParaFamilia(admin, {
      tenantId, familiaId: familia.id, alumnosActivos, mes, anio, concepto, descuentosPorAlumno,
      descuentoPuntualPct: previo?.descuento_puntual_pct,
      descuentoPuntualNota: previo?.descuento_puntual_nota,
      numeroReciboPrevio: previo?.numero_recibo || null,
    });
    if (insertOk) { generados += 1; reciboIdsPorFamilia[familia.id] = reciboId; }
    else errores.push({ familiaId: familia.id, error: insertErr });
  }
  if (errores.length) log?.error({ errores }, "academia recibos generar: algunos recibos no se pudieron crear");
  return { generados, errores, reciboIdsPorFamilia };
}

export default async function academiaRecibosGenerarRoutes(app) {
  const guard = makeTenantMembershipGuard();

  // POST /api/v1/academia/recibos/generar
  app.post("/generar", { preHandler: guard.preHandler }, async (req, reply) => {
    const requestId = req.requestId || makeRequestId();
    const tenantSlug = getTenantSlug(req);
    const auth = await requireRole(req, reply, requestId, { tenantSlug, roles: ["admin"] });
    if (!auth.ok) return;

    const parsed = PeriodoBodySchema.safeParse(req.body || {});
    if (!parsed.success) return fail(reply, 400, "invalid_body", "Invalid body", requestId, { issues: parsed.error.issues });
    const { mes, anio, familia_id } = parsed.data;

    const admin = createSupabaseAdmin();
    const { generados, errores, reciboIdsPorFamilia, error } = await generarParaFamiliasSinRecibo(admin, {
      tenantId: auth.tenant.id, tenantNombre: auth.tenant.name, mes, anio,
      soloFamiliaIds: familia_id ? new Set([familia_id]) : undefined,
      log: req.log,
    });
    if (error) {
      req.log.error({ err: error, requestId }, "academia recibos generar failed");
      return fail(reply, 500, "recibos_fetch_failed", "Failed to fetch data for generar", requestId);
    }
    return created(reply, {
      generados, fallidos: errores.length,
      ...(familia_id ? { reciboId: reciboIdsPorFamilia[familia_id] ?? null } : {}),
    }, requestId);
  });

  // POST /api/v1/academia/recibos/regenerar — combina "generar" y
  // "regenerar" en una sola operación: borra TODOS los recibos existentes
  // del período (borradores siempre; enviados/pagados solo si `confirmar`)
  // y genera recibos para TODAS las familias activas que sigan sin uno ese
  // mes/año. Política forward-only: si hay recibos ya enviados/pagados y no
  // se confirmó, no se toca nada y se devuelve 409 con el conteo afectado —
  // nunca se sobrescribe un enviado en silencio (ver evaluarConfirmacionRecibos).
  app.post("/regenerar", { preHandler: guard.preHandler }, async (req, reply) => {
    const requestId = req.requestId || makeRequestId();
    const tenantSlug = getTenantSlug(req);
    const auth = await requireRole(req, reply, requestId, { tenantSlug, roles: ["admin"] });
    if (!auth.ok) return;

    const parsed = PeriodoBodySchema.safeParse(req.body || {});
    if (!parsed.success) return fail(reply, 400, "invalid_body", "Invalid body", requestId, { issues: parsed.error.issues });
    const { mes, anio, confirmar } = parsed.data;
    const tenantId = auth.tenant.id;
    const admin = createSupabaseAdmin();

    const { porFamilia: recibosPrevios, error: recibosErr } = await fetchRecibosDelMes(admin, tenantId, { mes, anio });
    if (recibosErr) {
      req.log.error({ err: recibosErr, requestId }, "academia recibos regenerar: fetch recibos failed");
      return fail(reply, 500, "recibos_fetch_failed", "Failed to fetch recibos", requestId);
    }

    const previos = Object.values(recibosPrevios);
    const { requiereConfirmacion, afectados } = evaluarConfirmacionRecibos(previos, confirmar);
    if (requiereConfirmacion) {
      return fail(reply, 409, "requiere_confirmacion", "Hay recibos ya enviados o pagados en este período", requestId, { afectados });
    }

    for (const recibo of previos) {
      const { ok: delOk, error: delErr } = await eliminarRecibo(admin, { tenantId, reciboId: recibo.id });
      if (!delOk) req.log.error({ err: delErr, requestId }, "academia recibos regenerar: delete failed");
    }

    // Sin soloFamiliaIds — a diferencia de /:id/regenerar, aquí se quiere
    // a propósito que alcance a cualquier familia activa sin recibo.
    const { generados, errores, error } = await generarParaFamiliasSinRecibo(admin, {
      tenantId, tenantNombre: auth.tenant.name, mes, anio, previoPorFamilia: recibosPrevios, log: req.log,
    });
    if (error) {
      req.log.error({ err: error, requestId }, "academia recibos regenerar: generar failed");
      return fail(reply, 500, "recibos_fetch_failed", "Failed to regenerate recibos", requestId);
    }
    return ok(reply, { regenerados: generados, fallidos: errores.length }, requestId);
  });

  // POST /api/v1/academia/recibos/:id/regenerar — borra y recrea un único
  // recibo (mismo período y familia). Si ya está enviado/pagado, exige
  // `confirmar:true` en el body (409 con el estado/fecha_envio si no se
  // manda) — misma política forward-only que el lote.
  app.post("/:id/regenerar", { preHandler: guard.preHandler }, async (req, reply) => {
    const requestId = req.requestId || makeRequestId();
    const tenantSlug = getTenantSlug(req);
    const auth = await requireRole(req, reply, requestId, { tenantSlug, roles: ["admin"] });
    if (!auth.ok) return;

    const parsedParams = ParamsSchema.safeParse(req.params || {});
    if (!parsedParams.success) return fail(reply, 400, "invalid_params", "Invalid params", requestId);
    const parsedBody = ConfirmarBodySchema.safeParse(req.body || {});
    if (!parsedBody.success) return fail(reply, 400, "invalid_body", "Invalid body", requestId, { issues: parsedBody.error.issues });

    const tenantId = auth.tenant.id;
    const admin = createSupabaseAdmin();

    const { data: recibo, error: fetchErr } = await admin
      .from("academia_recibos")
      .select("id, familia_id, mes, anio, estado, fecha_envio, numero_recibo, descuento_puntual_pct, descuento_puntual_nota")
      .eq("id", parsedParams.data.id)
      .eq("tenant_id", tenantId)
      .maybeSingle();
    if (fetchErr) {
      req.log.error({ err: fetchErr, requestId }, "academia recibos POST /:id/regenerar: fetch failed");
      return fail(reply, 500, "recibo_fetch_failed", "Failed to fetch recibo", requestId);
    }
    if (!recibo) return fail(reply, 404, "recibo_not_found", "Recibo not found", requestId);
    if (recibo.estado !== "borrador" && !parsedBody.data.confirmar) {
      return fail(reply, 409, "requiere_confirmacion", "Este recibo ya se envió o pagó", requestId, {
        estado: recibo.estado,
        fecha_envio: recibo.fecha_envio,
      });
    }

    const { ok: delOk, error: delErr } = await eliminarRecibo(admin, { tenantId, reciboId: recibo.id });
    if (!delOk) {
      req.log.error({ err: delErr, requestId }, "academia recibos POST /:id/regenerar: delete failed");
      return fail(reply, 500, "recibo_delete_failed", "Failed to delete recibo", requestId);
    }

    const { generados, errores, reciboIdsPorFamilia, error } = await generarParaFamiliasSinRecibo(admin, {
      tenantId, tenantNombre: auth.tenant.name, mes: recibo.mes, anio: recibo.anio,
      soloFamiliaIds: new Set([recibo.familia_id]),
      previoPorFamilia: {
        [recibo.familia_id]: {
          numero_recibo: recibo.numero_recibo,
          descuento_puntual_pct: recibo.descuento_puntual_pct,
          descuento_puntual_nota: recibo.descuento_puntual_nota,
        },
      },
      log: req.log,
    });
    if (error) {
      req.log.error({ err: error, requestId }, "academia recibos POST /:id/regenerar: generar failed");
      return fail(reply, 500, "recibos_fetch_failed", "Failed to regenerate recibo", requestId);
    }
    if (errores.length) req.log.error({ errores, requestId }, "academia recibos POST /:id/regenerar: insert failed");
    // reciboId del recibo NUEVO (id distinto al borrado) — el frontend lo
    // necesita para recargar la vista por el id correcto tras regenerar,
    // ver tabRecibo.js.
    return ok(reply, { regenerado: generados > 0, reciboId: reciboIdsPorFamilia[recibo.familia_id] ?? null }, requestId);
  });
}
