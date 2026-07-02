import { z } from "zod";
import { makeRequestId } from "../../../lib/requestId.js";
import { ok, fail } from "../../../lib/http.js";
import { requireRole } from "../../../lib/middleware.js";
import { getTenantSlug } from "../../../lib/tenantSlug.js";
import { createSupabaseAdmin } from "../../../lib/supabase.js";
import { makeTenantMembershipGuard } from "../../../lib/security/tenantMembershipGuard.js";
import { fetchFamiliasConAlumnos, fetchRecibosDelMes, fetchReciboCompleto, fetchAlumnosConSesionesMes } from "../../../lib/academiaRecibos/consultas.js";
import { fetchMesesEnviados } from "../../../lib/academiaRecibos/mesesEnviados.js";

const MesAnioQuerySchema = z.object({
  mes: z.coerce.number().int().min(1).max(12),
  anio: z.coerce.number().int().min(2000).max(2100),
});
const AnioQuerySchema = z.object({
  anio: z.coerce.number().int().min(2000).max(2100),
});
const ParamsSchema = z.object({ id: z.string().uuid() });

function buildListItem({ familia, alumnosActivos, recibo, conSesiones }) {
  return {
    familia_id: familia.id,
    familia_nombre: familia.nombre,
    familia_email: familia.email,
    familia_metodo_pago: familia.metodo_pago,
    recibo: recibo
      ? { id: recibo.id, estado: recibo.estado, total_neto: recibo.total_neto, fecha_envio: recibo.fecha_envio }
      : null,
    alumnos_activos: alumnosActivos.map((a) => ({ ...a, tiene_sesiones: conSesiones.has(a.id) })),
    tiene_hermanos: alumnosActivos.length > 1,
  };
}

// GET/listado de recibos: por período, por id, y meses con enviados de un año.
export default async function academiaRecibosListadoRoutes(app) {
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

    const todosLosAlumnoIds = items.flatMap((item) => item.alumnosActivos.map((a) => a.id));
    const { conSesiones, error: sesionesErr } = await fetchAlumnosConSesionesMes(admin, auth.tenant.id, todosLosAlumnoIds, { mes, anio });
    if (sesionesErr) {
      req.log.error({ err: sesionesErr, requestId }, "academia recibos list: sesiones fetch failed");
      return fail(reply, 500, "recibos_fetch_failed", "Failed to fetch recibos", requestId);
    }

    const lista = items.map((item) => buildListItem({ ...item, recibo: porFamilia[item.familia.id] || null, conSesiones }));
    return ok(reply, { recibos: lista }, requestId);
  });

  // GET /api/v1/academia/recibos/meses-enviados?anio= — para marcar en el
  // selector de mes los que ya tienen al menos un recibo enviado ese año.
  app.get("/meses-enviados", { preHandler: guard.preHandler }, async (req, reply) => {
    const requestId = req.requestId || makeRequestId();
    const tenantSlug = getTenantSlug(req);
    const auth = await requireRole(req, reply, requestId, { tenantSlug, roles: ["admin"] });
    if (!auth.ok) return;

    const parsed = AnioQuerySchema.safeParse(req.query || {});
    if (!parsed.success) return fail(reply, 400, "invalid_query", "Invalid query", requestId, { issues: parsed.error.issues });

    const admin = createSupabaseAdmin();
    const { meses, error } = await fetchMesesEnviados(admin, auth.tenant.id, parsed.data.anio);
    if (error) {
      req.log.error({ err: error, requestId }, "academia recibos meses-enviados failed");
      return fail(reply, 500, "meses_fetch_failed", "Failed to fetch meses enviados", requestId);
    }
    return ok(reply, { meses }, requestId);
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
}
