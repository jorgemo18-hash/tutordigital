import { z } from "zod";
import { makeRequestId } from "../../../lib/requestId.js";
import { ok, fail } from "../../../lib/http.js";
import { requireRole } from "../../../lib/middleware.js";
import { getTenantSlug } from "../../../lib/tenantSlug.js";
import { createSupabaseAdmin } from "../../../lib/supabase.js";
import { makeTenantMembershipGuard } from "../../../lib/security/tenantMembershipGuard.js";
import {
  fetchHistorialDelPeriodo, estadoRecuperable, recuperarEstadoDelRecibo,
} from "../../../lib/academiaRecibos/historial.js";

const HistorialQuerySchema = z.object({
  familia_id: z.string().uuid(),
  mes: z.coerce.number().int().min(1).max(12),
  anio: z.coerce.number().int().min(2000).max(2100),
});
const ParamsSchema = z.object({ id: z.string().uuid() });

// El historial de los recibos de una familia en un mes (migración 134) y
// "recuperar" el estado que perdió un recibo al rehacerse.
export default async function academiaRecibosHistorialRoutes(app) {
  const guard = makeTenantMembershipGuard();

  // GET /api/v1/academia/recibos/historial?familia_id=&mes=&anio=
  app.get("/historial", { preHandler: guard.preHandler }, async (req, reply) => {
    const requestId = req.requestId || makeRequestId();
    const auth = await requireRole(req, reply, requestId, { tenantSlug: getTenantSlug(req), roles: ["admin"] });
    if (!auth.ok) return;
    const parsed = HistorialQuerySchema.safeParse(req.query || {});
    if (!parsed.success) return fail(reply, 400, "invalid_query", "Invalid query", requestId, { issues: parsed.error.issues });
    const { familia_id: familiaId, mes, anio } = parsed.data;

    const admin = createSupabaseAdmin();
    const [{ eventos, error }, { data: actual, error: actualErr }] = await Promise.all([
      fetchHistorialDelPeriodo(admin, auth.tenant.id, { familiaId, mes, anio }),
      admin.from("academia_recibos").select("id, estado").eq("tenant_id", auth.tenant.id)
        .eq("familia_id", familiaId).eq("mes", mes).eq("anio", anio).maybeSingle(),
    ]);
    if (error || actualErr) {
      req.log.error({ err: error || actualErr, requestId }, "academia recibos historial failed");
      return fail(reply, 500, "historial_failed", "No se pudo leer el historial", requestId);
    }
    return ok(reply, { eventos, recuperable: estadoRecuperable(eventos, actual) }, requestId);
  });

  // POST /api/v1/academia/recibos/:id/recuperar-estado
  app.post("/:id/recuperar-estado", { preHandler: guard.preHandler }, async (req, reply) => {
    const requestId = req.requestId || makeRequestId();
    const auth = await requireRole(req, reply, requestId, { tenantSlug: getTenantSlug(req), roles: ["admin"] });
    if (!auth.ok) return;
    const parsed = ParamsSchema.safeParse(req.params || {});
    if (!parsed.success) return fail(reply, 400, "invalid_params", "Invalid params", requestId);

    const r = await recuperarEstadoDelRecibo(createSupabaseAdmin(), { tenantId: auth.tenant.id, reciboId: parsed.data.id });
    if (!r.ok) {
      if (r.status === 500) req.log.error({ err: r, requestId }, "academia recibos recuperar-estado failed");
      return fail(reply, r.status, "recuperar_estado_failed", r.motivo, requestId);
    }
    return ok(reply, { recuperado: r.recuperado }, requestId);
  });
}
