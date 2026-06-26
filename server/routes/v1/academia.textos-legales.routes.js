import { z } from "zod";
import { makeRequestId } from "../../lib/requestId.js";
import { ok, created, fail } from "../../lib/http.js";
import { requireRole } from "../../lib/middleware.js";
import { getTenantSlug } from "../../lib/tenantSlug.js";
import { createSupabaseAdmin } from "../../lib/supabase.js";
import { makeTenantMembershipGuard } from "../../lib/security/tenantMembershipGuard.js";
import { fetchTextosLegalesPorTenant, fetchTextosLegalesActivosPorTipo } from "../../lib/academiaTextosLegales/consultas.js";

const TIPOS = ["email", "recibos", "ambos"];
const TextoLegalSchema = z.object({
  etiqueta: z.string().trim().min(1),
  tipo: z.enum(TIPOS),
  contenido: z.string().trim().optional().default(""),
  activo: z.boolean().optional().default(true),
});
const ParamsSchema = z.object({ id: z.string().uuid() });
const QuerySchema = z.object({ tipo: z.enum(["email", "recibos"]).optional() });
const SELECT_COLS = "id, etiqueta, tipo, contenido, activo";

// CRUD de textos legales configurables por tenant (LOPD, exención de IVA,
// avisos...) — tarjeta "Textos legales" en Ajustes › Marca y textos.
// Reutilizables en recibos/emails (cada texto lleva un tipo "email",
// "recibos" o "ambos" para saber dónde aplica), igual de simples que
// academia_descuentos_tipo: sin asignación por alumno, solo lista plana.
// `?tipo=email|recibos` filtra a solo los activos de ese tipo (+ "ambos")
// — lo usan los generadores de email/recibo; sin el query param devuelve
// la lista completa (activos e inactivos) para el CRUD de Ajustes.
export default async function academiaTextosLegalesRoutes(app) {
  const guard = makeTenantMembershipGuard();

  app.get("/", { preHandler: guard.preHandler }, async (req, reply) => {
    const requestId = req.requestId || makeRequestId();
    const tenantSlug = getTenantSlug(req);
    const auth = await requireRole(req, reply, requestId, { tenantSlug, roles: ["admin"] });
    if (!auth.ok) return;

    const parsedQuery = QuerySchema.safeParse(req.query || {});
    if (!parsedQuery.success) return fail(reply, 400, "invalid_query", "Invalid query", requestId, { issues: parsedQuery.error.issues });

    const admin = createSupabaseAdmin();
    if (parsedQuery.data.tipo) {
      const contenidos = await fetchTextosLegalesActivosPorTipo(admin, auth.tenant.id, parsedQuery.data.tipo);
      return ok(reply, { textos: contenidos }, requestId);
    }

    const { textos, error } = await fetchTextosLegalesPorTenant(admin, auth.tenant.id);
    if (error) {
      req.log.error({ err: error, requestId }, "academia textos-legales fetch failed");
      return fail(reply, 500, "textos_legales_fetch_failed", "Failed to fetch textos legales", requestId);
    }
    return ok(reply, { textos }, requestId);
  });

  app.post("/", { preHandler: guard.preHandler }, async (req, reply) => {
    const requestId = req.requestId || makeRequestId();
    const tenantSlug = getTenantSlug(req);
    const auth = await requireRole(req, reply, requestId, { tenantSlug, roles: ["admin"] });
    if (!auth.ok) return;

    const parsed = TextoLegalSchema.safeParse(req.body || {});
    if (!parsed.success) return fail(reply, 400, "invalid_body", "Invalid body", requestId, { issues: parsed.error.issues });

    const admin = createSupabaseAdmin();
    const { data, error } = await admin
      .from("academia_textos_legales")
      .insert({ tenant_id: auth.tenant.id, ...parsed.data })
      .select(SELECT_COLS)
      .single();
    if (error) {
      req.log.error({ err: error, requestId }, "academia textos-legales create failed");
      return fail(reply, 500, "texto_legal_create_failed", "Failed to create texto legal", requestId);
    }
    return created(reply, { texto: data }, requestId);
  });

  app.put("/:id", { preHandler: guard.preHandler }, async (req, reply) => {
    const requestId = req.requestId || makeRequestId();
    const tenantSlug = getTenantSlug(req);
    const auth = await requireRole(req, reply, requestId, { tenantSlug, roles: ["admin"] });
    if (!auth.ok) return;

    const parsedParams = ParamsSchema.safeParse(req.params || {});
    if (!parsedParams.success) return fail(reply, 400, "invalid_params", "Invalid params", requestId);
    const parsed = TextoLegalSchema.safeParse(req.body || {});
    if (!parsed.success) return fail(reply, 400, "invalid_body", "Invalid body", requestId, { issues: parsed.error.issues });

    const admin = createSupabaseAdmin();
    const { data, error } = await admin
      .from("academia_textos_legales")
      .update(parsed.data)
      .eq("id", parsedParams.data.id)
      .eq("tenant_id", auth.tenant.id)
      .select(SELECT_COLS)
      .maybeSingle();
    if (error) {
      req.log.error({ err: error, requestId }, "academia textos-legales update failed");
      return fail(reply, 500, "texto_legal_update_failed", "Failed to update texto legal", requestId);
    }
    if (!data) return fail(reply, 404, "texto_legal_not_found", "Texto legal not found", requestId);
    return ok(reply, { texto: data }, requestId);
  });

  app.delete("/:id", { preHandler: guard.preHandler }, async (req, reply) => {
    const requestId = req.requestId || makeRequestId();
    const tenantSlug = getTenantSlug(req);
    const auth = await requireRole(req, reply, requestId, { tenantSlug, roles: ["admin"] });
    if (!auth.ok) return;

    const parsedParams = ParamsSchema.safeParse(req.params || {});
    if (!parsedParams.success) return fail(reply, 400, "invalid_params", "Invalid params", requestId);

    const admin = createSupabaseAdmin();
    const { error } = await admin
      .from("academia_textos_legales")
      .delete()
      .eq("id", parsedParams.data.id)
      .eq("tenant_id", auth.tenant.id);
    if (error) {
      req.log.error({ err: error, requestId }, "academia textos-legales delete failed");
      return fail(reply, 500, "texto_legal_delete_failed", "Failed to delete texto legal", requestId);
    }
    return ok(reply, { deleted: true }, requestId);
  });
}
