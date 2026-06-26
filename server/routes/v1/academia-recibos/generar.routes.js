import { z } from "zod";
import { makeRequestId } from "../../../lib/requestId.js";
import { ok, created, fail } from "../../../lib/http.js";
import { requireRole } from "../../../lib/middleware.js";
import { getTenantSlug } from "../../../lib/tenantSlug.js";
import { createSupabaseAdmin } from "../../../lib/supabase.js";
import { makeTenantMembershipGuard } from "../../../lib/security/tenantMembershipGuard.js";
import { formatearConcepto } from "../../../lib/academiaRecibos/calculos.js";
import { fetchFamiliasConAlumnos, fetchRecibosDelMes, fetchConfig } from "../../../lib/academiaRecibos/consultas.js";
import { generarReciboParaFamilia, eliminarReciboBorrador } from "../../../lib/academiaRecibos/generarRecibo.js";
import { fetchDescuentosActivosPorAlumno } from "../../../lib/academiaDescuentos/consultas.js";

const PeriodoBodySchema = z.object({
  mes: z.number().int().min(1).max(12),
  anio: z.number().int().min(2000).max(2100),
});
const ParamsSchema = z.object({ id: z.string().uuid() });

// Genera un recibo por cada familia con alumnos activos del período que
// todavía no tenga uno. `soloFamiliaIds` (opcional) acota la generación a
// un subconjunto — solo lo usa /:id/regenerar tras borrar un borrador
// concreto, para no generar de paso recibos nuevos de otras familias que
// no se pidieron. /regenerar (regenera todo el período) y /generar no lo
// pasan a propósito: deben alcanzar a cualquier familia activa sin recibo.
// `log` (req.log de quien llama) es para los logs temporales de abajo —
// ver bug "descuentos recurrentes no se aplican en recibos": el cálculo ya
// se verificó correcto contra datos reales, pero estos logs quedan para
// confirmarlo también en producción si vuelve a reportarse. Quitar una vez
// confirmado.
async function generarParaFamiliasSinRecibo(admin, { tenantId, tenantNombre, mes, anio, soloFamiliaIds, log } = {}) {
  const [{ items, error: itemsErr }, { porFamilia, error: recibosErr }, config] = await Promise.all([
    fetchFamiliasConAlumnos(admin, tenantId),
    fetchRecibosDelMes(admin, tenantId, { mes, anio }),
    fetchConfig(admin, tenantId),
  ]);
  if (itemsErr || recibosErr) return { error: itemsErr || recibosErr };

  const alumnoIds = items.flatMap(({ alumnosActivos }) => alumnosActivos.map((a) => a.id));
  const { porAlumno: descuentosPorAlumno, error: descErr } = await fetchDescuentosActivosPorAlumno(admin, alumnoIds);
  if (descErr) return { error: descErr };
  log?.info(
    { mes, anio, alumnoIds, descuentosPorAlumno },
    "[temporal] academia recibos generar: descuentos recurrentes activos por alumno"
  );

  const concepto = formatearConcepto(config.concepto_recibo_plantilla, mes, anio, config.nombre_emisor || tenantNombre);
  let generados = 0;

  for (const { familia, alumnosActivos } of items) {
    if (soloFamiliaIds && !soloFamiliaIds.has(familia.id)) continue;
    if (!alumnosActivos.length) continue;
    if (porFamilia[familia.id]) continue;

    const { ok: insertOk } = await generarReciboParaFamilia(admin, {
      tenantId, familiaId: familia.id, alumnosActivos, mes, anio, concepto, descuentosPorAlumno,
    });
    if (insertOk) generados += 1;
  }
  return { generados };
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
    const { mes, anio } = parsed.data;

    const admin = createSupabaseAdmin();
    const { generados, error } = await generarParaFamiliasSinRecibo(admin, {
      tenantId: auth.tenant.id, tenantNombre: auth.tenant.name, mes, anio, log: req.log,
    });
    if (error) {
      req.log.error({ err: error, requestId }, "academia recibos generar failed");
      return fail(reply, 500, "recibos_fetch_failed", "Failed to fetch data for generar", requestId);
    }
    return created(reply, { generados }, requestId);
  });

  // POST /api/v1/academia/recibos/regenerar — combina "generar" y
  // "regenerar" en una sola operación: borra los borradores existentes del
  // período (si hay) y genera recibos para TODAS las familias activas que
  // sigan sin uno ese mes/año — tanto las que tenían un borrador recién
  // borrado como las que nunca tuvieron ninguno (antes se excluían: si no
  // había borradores que borrar, la ruta cortaba camino y no generaba
  // nada). Los enviados nunca se tocan.
  app.post("/regenerar", { preHandler: guard.preHandler }, async (req, reply) => {
    const requestId = req.requestId || makeRequestId();
    const tenantSlug = getTenantSlug(req);
    const auth = await requireRole(req, reply, requestId, { tenantSlug, roles: ["admin"] });
    if (!auth.ok) return;

    const parsed = PeriodoBodySchema.safeParse(req.body || {});
    if (!parsed.success) return fail(reply, 400, "invalid_body", "Invalid body", requestId, { issues: parsed.error.issues });
    const { mes, anio } = parsed.data;
    const tenantId = auth.tenant.id;
    const admin = createSupabaseAdmin();

    const { data: borradores, error: borradoresErr } = await admin
      .from("academia_recibos")
      .select("id")
      .eq("tenant_id", tenantId)
      .eq("mes", mes)
      .eq("anio", anio)
      .eq("estado", "borrador");
    if (borradoresErr) {
      req.log.error({ err: borradoresErr, requestId }, "academia recibos regenerar: fetch borradores failed");
      return fail(reply, 500, "recibos_fetch_failed", "Failed to fetch borradores", requestId);
    }

    for (const { id } of borradores || []) {
      const { ok: delOk, error: delErr } = await eliminarReciboBorrador(admin, { tenantId, reciboId: id });
      if (!delOk) req.log.error({ err: delErr, requestId }, "academia recibos regenerar: delete failed");
    }

    // Sin soloFamiliaIds — a diferencia de /:id/regenerar, aquí se quiere
    // a propósito que alcance a cualquier familia activa sin recibo.
    const { generados, error } = await generarParaFamiliasSinRecibo(admin, {
      tenantId, tenantNombre: auth.tenant.name, mes, anio, log: req.log,
    });
    if (error) {
      req.log.error({ err: error, requestId }, "academia recibos regenerar: generar failed");
      return fail(reply, 500, "recibos_fetch_failed", "Failed to regenerate recibos", requestId);
    }
    return ok(reply, { regenerados: generados }, requestId);
  });

  // POST /api/v1/academia/recibos/:id/regenerar — borra y recrea un único
  // borrador (mismo período y familia). 409 si el recibo ya está enviado.
  app.post("/:id/regenerar", { preHandler: guard.preHandler }, async (req, reply) => {
    const requestId = req.requestId || makeRequestId();
    const tenantSlug = getTenantSlug(req);
    const auth = await requireRole(req, reply, requestId, { tenantSlug, roles: ["admin"] });
    if (!auth.ok) return;

    const parsedParams = ParamsSchema.safeParse(req.params || {});
    if (!parsedParams.success) return fail(reply, 400, "invalid_params", "Invalid params", requestId);

    const tenantId = auth.tenant.id;
    const admin = createSupabaseAdmin();

    const { data: recibo, error: fetchErr } = await admin
      .from("academia_recibos")
      .select("id, familia_id, mes, anio, estado")
      .eq("id", parsedParams.data.id)
      .eq("tenant_id", tenantId)
      .maybeSingle();
    if (fetchErr) {
      req.log.error({ err: fetchErr, requestId }, "academia recibos POST /:id/regenerar: fetch failed");
      return fail(reply, 500, "recibo_fetch_failed", "Failed to fetch recibo", requestId);
    }
    if (!recibo) return fail(reply, 404, "recibo_not_found", "Recibo not found", requestId);
    if (recibo.estado !== "borrador") {
      return fail(reply, 409, "recibo_not_editable", "Solo se pueden regenerar recibos en borrador", requestId);
    }

    const { ok: delOk, error: delErr, motivo } = await eliminarReciboBorrador(admin, { tenantId, reciboId: recibo.id });
    if (!delOk) {
      req.log.error({ err: delErr, requestId }, "academia recibos POST /:id/regenerar: delete failed");
      return fail(reply, 500, "recibo_delete_failed", motivo || "Failed to delete recibo", requestId);
    }

    const { generados, error } = await generarParaFamiliasSinRecibo(admin, {
      tenantId, tenantNombre: auth.tenant.name, mes: recibo.mes, anio: recibo.anio,
      soloFamiliaIds: new Set([recibo.familia_id]), log: req.log,
    });
    if (error) {
      req.log.error({ err: error, requestId }, "academia recibos POST /:id/regenerar: generar failed");
      return fail(reply, 500, "recibos_fetch_failed", "Failed to regenerate recibo", requestId);
    }
    return ok(reply, { regenerado: generados > 0 }, requestId);
  });
}
