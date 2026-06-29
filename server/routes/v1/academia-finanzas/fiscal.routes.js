import { z } from "zod";
import { makeRequestId } from "../../../lib/requestId.js";
import { ok, fail } from "../../../lib/http.js";
import { requireRole } from "../../../lib/middleware.js";
import { getTenantSlug } from "../../../lib/tenantSlug.js";
import { createSupabaseAdmin } from "../../../lib/supabase.js";
import { makeTenantMembershipGuard } from "../../../lib/security/tenantMembershipGuard.js";
import { fetchIngresosGastosTrimestre } from "../../../lib/academiaFinanzas/fiscalConsultas.js";
import { fetchRegimenFiscal } from "../../../lib/academiaFinanzas/fiscalRegimen.js";
import { fetchTrimestreGuardado, guardarTrimestre } from "../../../lib/academiaFinanzas/fiscalTrimestresStore.js";

const MODELOS = ["130", "202", "115", "111"];
const AnioTrimestreQuerySchema = z.object({
  anio: z.coerce.number().int().min(2000).max(2100),
  trimestre: z.coerce.number().int().min(1).max(4),
});
const GuardarTrimestreSchema = z.object({
  modelo: z.enum(MODELOS),
  anio: z.number().int().min(2000).max(2100),
  trimestre: z.number().int().min(1).max(4),
  datos: z.object({
    editable: z.record(z.string(), z.number()),
    overrides: z.record(z.string(), z.number()).optional().default({}),
    calculado: z.record(z.string(), z.number()).optional(),
  }),
});

// Sin fila guardada para ese modelo/período, cada uno arranca con estos
// valores por defecto (130 es distinto: su "calculado" sale de Ingresos/
// Gastos reales, no de una constante — ver cargarModelo130 más abajo).
const DEFAULTS_POR_MODELO = {
  "202": { editable: { base_imponible: 0, tipo_gravamen: 25, pagos_fraccionados_anteriores: 0 }, overrides: {} },
  "115": { editable: { base_mensual: 0 }, overrides: {} },
  "111": { editable: { base_trimestral: 0, retencion_pct: 15 }, overrides: {} },
};

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

// Carga el período guardado si existe; si no, calcula el valor por
// defecto (distinto para 130, que necesita leer Ingresos/Gastos reales).
async function cargarModelo(admin, tenantId, { anio, trimestre, modelo }) {
  const { datos: guardado, error: errGuardado } = await fetchTrimestreGuardado(admin, tenantId, { anio, trimestre, modelo });
  if (errGuardado) return { error: errGuardado };
  if (guardado) return { datos: guardado };

  if (modelo === "130") {
    const { calculado, error } = await fetchIngresosGastosTrimestre(admin, tenantId, { anio, trimestre });
    if (error) return { error };
    return { datos: { editable: { minoracion: 0 }, overrides: {}, calculado } };
  }
  return { datos: DEFAULTS_POR_MODELO[modelo] };
}

export default async function academiaFinanzasFiscalRoutes(app) {
  const guard = makeTenantMembershipGuard();

  // GET /api/v1/academia/finanzas/fiscal/regimen — decide qué modelos
  // muestra el frontend (130 si autónomo, 202 si sociedad, ninguno si null).
  app.get("/regimen", { preHandler: guard.preHandler }, async (req, reply) => {
    const requestId = req.requestId || makeRequestId();
    const tenantSlug = getTenantSlug(req);
    const auth = await requireRole(req, reply, requestId, { tenantSlug, roles: ["admin"] });
    if (!auth.ok) return;

    const admin = createSupabaseAdmin();
    const { regimen_fiscal, error } = await fetchRegimenFiscal(admin, auth.tenant.id);
    if (error) {
      req.log.error({ err: error, requestId }, "academia finanzas fiscal regimen failed");
      return fail(reply, 500, "fiscal_regimen_failed", "Failed to fetch regimen fiscal", requestId);
    }
    return ok(reply, { regimen_fiscal }, requestId);
  });

  for (const modelo of MODELOS) {
    // GET /api/v1/academia/finanzas/fiscal/{130,202,115,111}?anio=&trimestre=
    app.get(`/${modelo}`, { preHandler: guard.preHandler }, async (req, reply) => {
      const requestId = req.requestId || makeRequestId();
      const auth = await autorizarYParsearPeriodo(req, reply, requestId);
      if (!auth.ok) return;

      const admin = createSupabaseAdmin();
      const { datos, error } = await cargarModelo(admin, auth.tenantId, { anio: auth.anio, trimestre: auth.trimestre, modelo });
      if (error) {
        req.log.error({ err: error, requestId }, `academia finanzas fiscal ${modelo} failed`);
        return fail(reply, 500, `fiscal_${modelo}_failed`, `Failed to fetch modelo ${modelo}`, requestId);
      }
      return ok(reply, { datos }, requestId);
    });
  }

  // PUT /api/v1/academia/finanzas/fiscal/trimestre — guarda los valores
  // editados a mano (y qué casillas calculadas fueron sobrescritas) de
  // cualquiera de los 4 modelos para un período concreto.
  app.put("/trimestre", { preHandler: guard.preHandler }, async (req, reply) => {
    const requestId = req.requestId || makeRequestId();
    const tenantSlug = getTenantSlug(req);
    const auth = await requireRole(req, reply, requestId, { tenantSlug, roles: ["admin"] });
    if (!auth.ok) return;

    const parsed = GuardarTrimestreSchema.safeParse(req.body || {});
    if (!parsed.success) return fail(reply, 400, "invalid_body", "Invalid body", requestId, { issues: parsed.error.issues });

    const admin = createSupabaseAdmin();
    const { error } = await guardarTrimestre(admin, auth.tenant.id, parsed.data);
    if (error) {
      req.log.error({ err: error, requestId }, "academia finanzas fiscal guardar trimestre failed");
      return fail(reply, 500, "fiscal_guardar_failed", "Failed to save trimestre", requestId);
    }
    return ok(reply, { saved: true }, requestId);
  });
}
