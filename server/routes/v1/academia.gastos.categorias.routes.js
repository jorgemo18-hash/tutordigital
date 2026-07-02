import { z } from "zod";
import { makeRequestId } from "../../lib/requestId.js";
import { ok, created, fail } from "../../lib/http.js";
import { requireRole } from "../../lib/middleware.js";
import { getTenantSlug } from "../../lib/tenantSlug.js";
import { createSupabaseAdmin } from "../../lib/supabase.js";
import { makeTenantMembershipGuard } from "../../lib/security/tenantMembershipGuard.js";

const CategoriaSchema = z.object({ nombre: z.string().trim().min(1).max(50) });
const ParamsSchema = z.object({ id: z.string().uuid() });
const SELECT_COLS = "id, nombre, es_predefinida";

// CRUD de categorías de gasto configurables por tenant (Ajustes ›
// Facturación › "Categorías de gastos", y el selector del drawer de
// gastos — ver gastoCategoriaSelect.js). Las 8 predefinidas de fábrica se
// insertan al crear el tenant (ver superadmin.tenant.create.routes.js,
// server/lib/academiaFinanzas/gastoCategoriasPredefinidas.js) y nunca se
// pueden borrar desde aquí.
export default async function academiaGastosCategoriasRoutes(app) {
  const guard = makeTenantMembershipGuard();

  // GET / — predefinidas primero, luego personalizadas, alfabético dentro
  // de cada grupo. El selector del drawer reordena "Otros" al final por su
  // cuenta (ver ordenarConOtrosAlFinal en gastoCategoriaSelect.js) — esta
  // ruta no conoce ese detalle de UI, solo devuelve un orden razonable.
  app.get("/", { preHandler: guard.preHandler }, async (req, reply) => {
    const requestId = req.requestId || makeRequestId();
    const tenantSlug = getTenantSlug(req);
    const auth = await requireRole(req, reply, requestId, { tenantSlug, roles: ["admin"] });
    if (!auth.ok) return;

    const admin = createSupabaseAdmin();
    const { data, error } = await admin
      .from("academia_gastos_categorias")
      .select(SELECT_COLS)
      .eq("tenant_id", auth.tenant.id)
      .order("es_predefinida", { ascending: false })
      .order("nombre", { ascending: true });
    if (error) {
      req.log.error({ err: error, requestId }, "academia gastos categorias fetch failed");
      return fail(reply, 500, "categorias_fetch_failed", "Failed to fetch categorias", requestId);
    }
    return ok(reply, { categorias: data || [] }, requestId);
  });

  // POST / — crea una categoría personalizada (es_predefinida siempre
  // false aquí). El nombre tiene un unique (tenant_id, nombre) en BD —
  // 23505 se traduce a 409 "ya_existe" en vez de 500.
  app.post("/", { preHandler: guard.preHandler }, async (req, reply) => {
    const requestId = req.requestId || makeRequestId();
    const tenantSlug = getTenantSlug(req);
    const auth = await requireRole(req, reply, requestId, { tenantSlug, roles: ["admin"] });
    if (!auth.ok) return;

    const parsed = CategoriaSchema.safeParse(req.body || {});
    if (!parsed.success) return fail(reply, 400, "invalid_body", "Invalid body", requestId, { issues: parsed.error.issues });

    const admin = createSupabaseAdmin();
    const { data, error } = await admin
      .from("academia_gastos_categorias")
      .insert({ tenant_id: auth.tenant.id, nombre: parsed.data.nombre, es_predefinida: false })
      .select(SELECT_COLS)
      .single();
    if (error) {
      if (error.code === "23505") return fail(reply, 409, "ya_existe", "Esta categoría ya existe", requestId);
      req.log.error({ err: error, requestId }, "academia gastos categorias create failed");
      return fail(reply, 500, "categoria_create_failed", "Failed to create categoria", requestId);
    }
    return created(reply, { categoria: data }, requestId);
  });

  // DELETE /:id — solo categorías personalizadas (es_predefinida=false).
  app.delete("/:id", { preHandler: guard.preHandler }, async (req, reply) => {
    const requestId = req.requestId || makeRequestId();
    const tenantSlug = getTenantSlug(req);
    const auth = await requireRole(req, reply, requestId, { tenantSlug, roles: ["admin"] });
    if (!auth.ok) return;

    const parsedParams = ParamsSchema.safeParse(req.params || {});
    if (!parsedParams.success) return fail(reply, 400, "invalid_params", "Invalid params", requestId);

    const admin = createSupabaseAdmin();
    const { data: categoria, error: fetchErr } = await admin
      .from("academia_gastos_categorias")
      .select("id, es_predefinida")
      .eq("id", parsedParams.data.id)
      .eq("tenant_id", auth.tenant.id)
      .maybeSingle();
    if (fetchErr) {
      req.log.error({ err: fetchErr, requestId }, "academia gastos categorias delete: fetch failed");
      return fail(reply, 500, "categoria_fetch_failed", "Failed to fetch categoria", requestId);
    }
    if (!categoria) return fail(reply, 404, "categoria_not_found", "Categoria not found", requestId);
    if (categoria.es_predefinida) {
      return fail(reply, 403, "categoria_predefinida", "Las categorías predefinidas no se pueden eliminar", requestId);
    }

    const { error } = await admin
      .from("academia_gastos_categorias")
      .delete()
      .eq("id", parsedParams.data.id)
      .eq("tenant_id", auth.tenant.id);
    if (error) {
      req.log.error({ err: error, requestId }, "academia gastos categorias delete failed");
      return fail(reply, 500, "categoria_delete_failed", "Failed to delete categoria", requestId);
    }
    return ok(reply, { deleted: true }, requestId);
  });
}
