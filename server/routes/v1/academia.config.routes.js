import { makeRequestId } from "../../lib/requestId.js";
import { ok, fail } from "../../lib/http.js";
import { requireRole } from "../../lib/middleware.js";
import { getTenantSlug } from "../../lib/tenantSlug.js";
import { createSupabaseAdmin } from "../../lib/supabase.js";
import { makeTenantMembershipGuard } from "../../lib/security/tenantMembershipGuard.js";

const DEFAULTS = {
  franja_inicio: "09:00",
  franja_fin: "21:00",
  franja_duracion: 60,
  dias_laborables: [1, 2, 3, 4, 5],
};

// GET /api/v1/academia/config — franjas y días laborables del centro, usados
// por el horario semanal para generar el grid. Si el tenant aún no tiene fila
// en academia_config, devuelve los valores por defecto de la tabla en vez de 404.
export default async function academiaConfigRoutes(app) {
  const guard = makeTenantMembershipGuard();

  app.get("/", { preHandler: guard.preHandler }, async (req, reply) => {
    const requestId = req.requestId || makeRequestId();
    const tenantSlug = getTenantSlug(req);
    const auth = await requireRole(req, reply, requestId, {
      tenantSlug,
      roles: ["admin", "teacher"],
    });
    if (!auth.ok) return;

    const admin = createSupabaseAdmin();
    const { data, error } = await admin
      .from("academia_config")
      .select("franja_inicio, franja_fin, franja_duracion, dias_laborables")
      .eq("tenant_id", auth.tenant.id)
      .maybeSingle();

    if (error) {
      req.log.error({ err: error, requestId }, "academia config fetch failed");
      return fail(reply, 500, "config_fetch_failed", "Failed to fetch config", requestId);
    }

    return ok(reply, { config: data || DEFAULTS }, requestId);
  });
}
