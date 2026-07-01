import { z } from "zod";
import { makeRequestId } from "../../../lib/requestId.js";
import { ok, created, fail } from "../../../lib/http.js";
import { requireRole } from "../../../lib/middleware.js";
import { getTenantSlug } from "../../../lib/tenantSlug.js";
import { createSupabaseAdmin } from "../../../lib/supabase.js";
import { makeTenantMembershipGuard } from "../../../lib/security/tenantMembershipGuard.js";
import {
  fetchResumenGastos,
  fetchListaGastos,
  fetchCategoriasGastos,
  insertGasto,
  updateGasto,
  deleteGasto,
} from "../../../lib/academiaFinanzas/gastosConsultas.js";
import { normalizarProveedor } from "../../../lib/academiaFinanzas/normalizarProveedor.js";

const MesAnioQuerySchema = z.object({
  mes: z.coerce.number().int().min(1).max(12),
  anio: z.coerce.number().int().min(2000).max(2100),
});
const ParamsSchema = z.object({ id: z.string().uuid() });
const GastoSchema = z.object({
  fecha: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  proveedor: z.string().trim().optional(),
  concepto: z.string().trim().min(1),
  categoria: z.string().trim().optional(),
  cif: z.string().trim().optional(),
  // El frontend envía el importe TOTAL (lo que se paga) y el tipo de IVA;
  // base_imponible/iva_importe se derivan aquí, no los manda el cliente.
  importe: z.number().min(0),
  iva_pct: z.number().min(0).max(100).optional(),
  notas: z.string().trim().optional(),
  foto_url: z.string().trim().optional(),
});

// Deriva base_imponible/iva_importe desde el importe total y el tipo de
// IVA — al revés que un presupuesto (que parte de la base): aquí el admin
// introduce lo que paga y queremos saber cuánto de eso es base vs IVA. Sin
// IVA no hay nada que desglosar, así que quedan en null.
function resolverImportes({ importe, iva_pct = 0 }) {
  if (!iva_pct) return { base_imponible: null, iva_importe: null, iva_pct: null };
  const base_imponible = Math.round((importe / (1 + iva_pct / 100)) * 100) / 100;
  const iva_importe = Math.round((importe - base_imponible) * 100) / 100;
  return { base_imponible, iva_importe, iva_pct };
}

async function autorizarAdmin(req, reply, requestId) {
  const tenantSlug = getTenantSlug(req);
  const auth = await requireRole(req, reply, requestId, { tenantSlug, roles: ["admin"] });
  if (!auth.ok) return { ok: false };
  return { ok: true, tenantId: auth.tenant.id };
}

async function autorizarYParsearMesAnio(req, reply, requestId) {
  const auth = await autorizarAdmin(req, reply, requestId);
  if (!auth.ok) return { ok: false };

  const parsed = MesAnioQuerySchema.safeParse(req.query || {});
  if (!parsed.success) {
    fail(reply, 400, "invalid_query", "Invalid query", requestId, { issues: parsed.error.issues });
    return { ok: false };
  }
  return { ok: true, tenantId: auth.tenantId, mes: parsed.data.mes, anio: parsed.data.anio };
}

function parsearParamsId(req, reply, requestId) {
  const parsed = ParamsSchema.safeParse(req.params || {});
  if (!parsed.success) {
    fail(reply, 400, "invalid_params", "Invalid params", requestId);
    return null;
  }
  return parsed.data.id;
}

// Datos reales de la pestaña Gastos — crear/editar/eliminar no existían
// todavía (solo la tabla academia_gastos, vacía); aquí se añade POST para
// que "+ Añadir gasto" persista de verdad, junto a los 3 endpoints de
// lectura que pide la vista general.
export default async function academiaFinanzasGastosRoutes(app) {
  const guard = makeTenantMembershipGuard();

  app.get("/resumen", { preHandler: guard.preHandler }, async (req, reply) => {
    const requestId = req.requestId || makeRequestId();
    const auth = await autorizarYParsearMesAnio(req, reply, requestId);
    if (!auth.ok) return;

    const admin = createSupabaseAdmin();
    const { resumen, error } = await fetchResumenGastos(admin, auth.tenantId, { mes: auth.mes, anio: auth.anio });
    if (error) {
      req.log.error({ err: error, requestId }, "academia finanzas gastos resumen failed");
      return fail(reply, 500, "gastos_resumen_failed", "Failed to fetch resumen", requestId);
    }
    return ok(reply, { resumen }, requestId);
  });

  app.get("/lista", { preHandler: guard.preHandler }, async (req, reply) => {
    const requestId = req.requestId || makeRequestId();
    const auth = await autorizarYParsearMesAnio(req, reply, requestId);
    if (!auth.ok) return;

    const admin = createSupabaseAdmin();
    const { gastos, error } = await fetchListaGastos(admin, auth.tenantId, { mes: auth.mes, anio: auth.anio });
    if (error) {
      req.log.error({ err: error, requestId }, "academia finanzas gastos lista failed");
      return fail(reply, 500, "gastos_lista_failed", "Failed to fetch lista", requestId);
    }
    return ok(reply, { gastos }, requestId);
  });

  app.get("/categorias", { preHandler: guard.preHandler }, async (req, reply) => {
    const requestId = req.requestId || makeRequestId();
    const auth = await autorizarYParsearMesAnio(req, reply, requestId);
    if (!auth.ok) return;

    const admin = createSupabaseAdmin();
    const { categorias, error } = await fetchCategoriasGastos(admin, auth.tenantId, { mes: auth.mes, anio: auth.anio });
    if (error) {
      req.log.error({ err: error, requestId }, "academia finanzas gastos categorias failed");
      return fail(reply, 500, "gastos_categorias_failed", "Failed to fetch categorias", requestId);
    }
    return ok(reply, { categorias }, requestId);
  });

  // POST /api/v1/academia/finanzas/gastos — usado por "+ Añadir gasto".
  app.post("/", { preHandler: guard.preHandler }, async (req, reply) => {
    const requestId = req.requestId || makeRequestId();
    const auth = await autorizarAdmin(req, reply, requestId);
    if (!auth.ok) return;

    const parsed = GastoSchema.safeParse(req.body || {});
    if (!parsed.success) return fail(reply, 400, "invalid_body", "Invalid body", requestId, { issues: parsed.error.issues });

    const admin = createSupabaseAdmin();
    const campos = resolverImportes(parsed.data);
    const proveedor = normalizarProveedor(parsed.data.proveedor);
    const { gasto, error } = await insertGasto(admin, auth.tenantId, { ...parsed.data, ...campos, proveedor });
    if (error) {
      req.log.error({ err: error, requestId }, "academia finanzas gastos create failed");
      return fail(reply, 500, "gasto_create_failed", "Failed to create gasto", requestId);
    }
    return created(reply, { gasto }, requestId);
  });

  // PUT /api/v1/academia/finanzas/gastos/:id — drawer de detalle/edición.
  app.put("/:id", { preHandler: guard.preHandler }, async (req, reply) => {
    const requestId = req.requestId || makeRequestId();
    const auth = await autorizarAdmin(req, reply, requestId);
    if (!auth.ok) return;

    const id = parsearParamsId(req, reply, requestId);
    if (!id) return;
    const parsed = GastoSchema.safeParse(req.body || {});
    if (!parsed.success) return fail(reply, 400, "invalid_body", "Invalid body", requestId, { issues: parsed.error.issues });

    const admin = createSupabaseAdmin();
    const campos = resolverImportes(parsed.data);
    const proveedor = normalizarProveedor(parsed.data.proveedor);
    const { gasto, error } = await updateGasto(admin, auth.tenantId, id, { ...parsed.data, ...campos, proveedor });
    if (error) {
      req.log.error({ err: error, requestId }, "academia finanzas gastos update failed");
      return fail(reply, 500, "gasto_update_failed", "Failed to update gasto", requestId);
    }
    if (!gasto) return fail(reply, 404, "gasto_not_found", "Gasto not found", requestId);
    return ok(reply, { gasto }, requestId);
  });

  // DELETE /api/v1/academia/finanzas/gastos/:id
  app.delete("/:id", { preHandler: guard.preHandler }, async (req, reply) => {
    const requestId = req.requestId || makeRequestId();
    const auth = await autorizarAdmin(req, reply, requestId);
    if (!auth.ok) return;

    const id = parsearParamsId(req, reply, requestId);
    if (!id) return;

    const admin = createSupabaseAdmin();
    const { error } = await deleteGasto(admin, auth.tenantId, id);
    if (error) {
      req.log.error({ err: error, requestId }, "academia finanzas gastos delete failed");
      return fail(reply, 500, "gasto_delete_failed", "Failed to delete gasto", requestId);
    }
    return ok(reply, { deleted: true }, requestId);
  });
}
