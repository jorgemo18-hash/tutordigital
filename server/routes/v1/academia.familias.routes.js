import { makeRequestId } from "../../lib/requestId.js";
import { ok, fail } from "../../lib/http.js";
import { requireRole } from "../../lib/middleware.js";
import { getTenantSlug } from "../../lib/tenantSlug.js";
import { createSupabaseAdmin } from "../../lib/supabase.js";
import { makeTenantMembershipGuard } from "../../lib/security/tenantMembershipGuard.js";

// GET /api/v1/academia/familias — listado mínimo (id, nombre, email) para
// el selector "Familia existente" del drawer de alumnos. El detalle completo
// de una familia viaja embebido en GET /academia/alumnos/:id.
export default async function academiaFamiliasRoutes(app) {
  const guard = makeTenantMembershipGuard();

  app.get("/", { preHandler: guard.preHandler }, async (req, reply) => {
    const requestId = req.requestId || makeRequestId();
    const tenantSlug = getTenantSlug(req);
    const auth = await requireRole(req, reply, requestId, { tenantSlug, roles: ["admin"] });
    if (!auth.ok) return;

    const admin = createSupabaseAdmin();
    const { data, error } = await admin
      .from("academia_familias")
      .select("id, nombre, email")
      .eq("tenant_id", auth.tenant.id)
      .eq("activa", true)
      .order("nombre", { ascending: true });

    if (error) {
      req.log.error({ err: error, requestId }, "academia familias fetch failed");
      return fail(reply, 500, "familias_fetch_failed", "Failed to fetch familias", requestId);
    }
    return ok(reply, { familias: data || [] }, requestId);
  });
}
