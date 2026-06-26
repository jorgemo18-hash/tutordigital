import { z } from "zod";
import { makeRequestId } from "../../../lib/requestId.js";
import { ok, fail } from "../../../lib/http.js";
import { requireRole } from "../../../lib/middleware.js";
import { getTenantSlug } from "../../../lib/tenantSlug.js";
import { createSupabaseAdmin } from "../../../lib/supabase.js";
import { makeTenantMembershipGuard } from "../../../lib/security/tenantMembershipGuard.js";
import { fetchConfig } from "../../../lib/academiaRecibos/consultas.js";
import { enviarReciboPorId } from "../../../lib/academiaRecibos/enviar.js";

const MesAnioQuerySchema = z.object({
  mes: z.coerce.number().int().min(1).max(12),
  anio: z.coerce.number().int().min(2000).max(2100),
});
const ParamsSchema = z.object({ id: z.string().uuid() });

export default async function academiaRecibosEnviarRoutes(app) {
  const guard = makeTenantMembershipGuard();

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
