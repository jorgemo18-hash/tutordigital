import { z } from "zod";
import { makeRequestId } from "../../../lib/requestId.js";
import { ok, fail } from "../../../lib/http.js";
import { requireRole } from "../../../lib/middleware.js";
import { getTenantSlug } from "../../../lib/tenantSlug.js";
import { createSupabaseAdmin } from "../../../lib/supabase.js";
import { makeTenantMembershipGuard } from "../../../lib/security/tenantMembershipGuard.js";
import { fetchIngresosGastosTrimestre, fetchIvaDeducibleTrimestre } from "../../../lib/academiaFinanzas/fiscalConsultas.js";
import { fetchRegimenFiscal } from "../../../lib/academiaFinanzas/fiscalRegimen.js";
import { fetchTrimestreGuardado, guardarTrimestre } from "../../../lib/academiaFinanzas/fiscalTrimestresStore.js";
import { fetchCuatroTrimestres } from "../../../lib/academiaFinanzas/fiscalAnualConsultas.js";

const MODELOS_TRIM  = ["130", "202", "115", "111", "303"];
const MODELOS_ANUAL = ["180", "390"];

const AnioTrimestreQuerySchema = z.object({
  anio:     z.coerce.number().int().min(2000).max(2100),
  trimestre: z.coerce.number().int().min(1).max(4),
});
const AnioQuerySchema = z.object({
  anio: z.coerce.number().int().min(2000).max(2100),
});
const GuardarTrimestreSchema = z.object({
  modelo:   z.enum([...MODELOS_TRIM, ...MODELOS_ANUAL]),
  anio:     z.number().int().min(2000).max(2100),
  trimestre: z.number().int().min(0).max(4),
  datos:    z.object({
    editable:  z.record(z.string(), z.unknown()).optional().default({}),
    overrides: z.record(z.string(), z.number()).optional().default({}),
    calculado: z.record(z.string(), z.number()).optional(),
  }),
});

// Sin fila guardada para ese modelo/período, cada uno arranca con estos
// valores por defecto (130 y 303 son distintos: sus casillas derivadas de
// datos reales — ver cargarModelo más abajo).
const DEFAULTS_POR_MODELO = {
  "202": { editable: { base_imponible: 0, tipo_gravamen: 25, pagos_fraccionados_anteriores: 0 }, overrides: {} },
  "115": { editable: { base_mensual: 0 }, overrides: {} },
  "111": { editable: { base_trimestral: 0, retencion_pct: 15 }, overrides: {} },
  "303": { editable: { base_general: 0, base_reducido: 0, base_superreducido: 0 }, overrides: {} },
};

async function autorizarYParsearPeriodo(req, reply, requestId, schema = AnioTrimestreQuerySchema) {
  const tenantSlug = getTenantSlug(req);
  const auth = await requireRole(req, reply, requestId, { tenantSlug, roles: ["admin"] });
  if (!auth.ok) return { ok: false };
  const parsed = schema.safeParse(req.query || {});
  if (!parsed.success) {
    fail(reply, 400, "invalid_query", "Invalid query", requestId, { issues: parsed.error.issues });
    return { ok: false };
  }
  return { ok: true, tenantId: auth.tenant.id, ...parsed.data };
}

async function cargarModelo(admin, tenantId, { anio, trimestre, modelo }) {
  const { datos: guardado, error } = await fetchTrimestreGuardado(admin, tenantId, { anio, trimestre, modelo });
  if (error) return { error };
  if (guardado) return { datos: guardado };

  if (modelo === "130") {
    const { calculado, error: e } = await fetchIngresosGastosTrimestre(admin, tenantId, { anio, trimestre });
    if (e) return { error: e };
    return { datos: { editable: { minoracion: 0 }, overrides: {}, calculado } };
  }
  if (modelo === "303") {
    const { iva_deducible, error: e } = await fetchIvaDeducibleTrimestre(admin, tenantId, { anio, trimestre });
    if (e) return { error: e };
    return { datos: { ...DEFAULTS_POR_MODELO["303"], calculado: { iva_deducible: iva_deducible ?? 0 } } };
  }
  return { datos: DEFAULTS_POR_MODELO[modelo] ?? { editable: {}, overrides: {} } };
}

export default async function academiaFinanzasFiscalRoutes(app) {
  const guard = makeTenantMembershipGuard();

  // GET /fiscal/regimen — régimen fiscal + tipo de tenant + desglose_iva.
  // El frontend usa esto para decidir qué pestaña/modelos mostrar.
  app.get("/regimen", { preHandler: guard.preHandler }, async (req, reply) => {
    const requestId = req.requestId || makeRequestId();
    const tenantSlug = getTenantSlug(req);
    const auth = await requireRole(req, reply, requestId, { tenantSlug, roles: ["admin"] });
    if (!auth.ok) return;
    const admin = createSupabaseAdmin();
    const { regimen_fiscal, tenant_type, desglose_iva, error } = await fetchRegimenFiscal(admin, auth.tenant.id);
    if (error) return fail(reply, 500, "fiscal_regimen_failed", "Failed to fetch regimen fiscal", requestId);
    return ok(reply, { regimen_fiscal, tenant_type, desglose_iva }, requestId);
  });

  // GET /fiscal/{130,202,115,111,303}?anio=&trimestre=
  for (const modelo of MODELOS_TRIM) {
    app.get(`/${modelo}`, { preHandler: guard.preHandler }, async (req, reply) => {
      const requestId = req.requestId || makeRequestId();
      const auth = await autorizarYParsearPeriodo(req, reply, requestId);
      if (!auth.ok) return;
      const admin = createSupabaseAdmin();
      const { datos, error } = await cargarModelo(admin, auth.tenantId, { anio: auth.anio, trimestre: auth.trimestre, modelo });
      if (error) return fail(reply, 500, `fiscal_${modelo}_failed`, `Failed to fetch modelo ${modelo}`, requestId);
      return ok(reply, { datos }, requestId);
    });
  }

  // GET /fiscal/{180,390}?anio= — datos del modelo anual guardados (trimestre=0)
  // más los cuatro trimestres del modelo fuente para calcular el resumen.
  for (const modelo of MODELOS_ANUAL) {
    const modeloFuente = modelo === "180" ? "115" : "303";
    app.get(`/${modelo}`, { preHandler: guard.preHandler }, async (req, reply) => {
      const requestId = req.requestId || makeRequestId();
      const auth = await autorizarYParsearPeriodo(req, reply, requestId, AnioQuerySchema);
      if (!auth.ok) return;
      const admin = createSupabaseAdmin();
      const [guardadoRes, trimestresRes] = await Promise.all([
        fetchTrimestreGuardado(admin, auth.tenantId, { anio: auth.anio, trimestre: 0, modelo }),
        fetchCuatroTrimestres(admin, auth.tenantId, { anio: auth.anio, modelo: modeloFuente }),
      ]);
      if (guardadoRes.error) return fail(reply, 500, `fiscal_${modelo}_failed`, `Failed to fetch modelo ${modelo}`, requestId);
      if (trimestresRes.error) return fail(reply, 500, `fiscal_${modelo}_fuente_failed`, `Failed to fetch fuente ${modeloFuente}`, requestId);
      return ok(reply, { datos: guardadoRes.datos || null, trimestres: trimestresRes.trimestres }, requestId);
    });
  }

  // PUT /fiscal/trimestre — guarda valores editados para cualquier modelo
  // (trimestrales con trimestre 1-4, anuales con trimestre=0).
  app.put("/trimestre", { preHandler: guard.preHandler }, async (req, reply) => {
    const requestId = req.requestId || makeRequestId();
    const tenantSlug = getTenantSlug(req);
    const auth = await requireRole(req, reply, requestId, { tenantSlug, roles: ["admin"] });
    if (!auth.ok) return;
    const parsed = GuardarTrimestreSchema.safeParse(req.body || {});
    if (!parsed.success) return fail(reply, 400, "invalid_body", "Invalid body", requestId, { issues: parsed.error.issues });
    const admin = createSupabaseAdmin();
    const { error } = await guardarTrimestre(admin, auth.tenant.id, parsed.data);
    if (error) return fail(reply, 500, "fiscal_guardar_failed", "Failed to save trimestre", requestId);
    return ok(reply, { saved: true }, requestId);
  });
}
