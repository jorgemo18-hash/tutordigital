import { makeRequestId } from "../../lib/requestId.js";
import { ok, fail } from "../../lib/http.js";
import { requireRole } from "../../lib/middleware.js";
import { getTenantSlug } from "../../lib/tenantSlug.js";
import { createSupabaseAdmin } from "../../lib/supabase.js";
import { makeTenantMembershipGuard } from "../../lib/security/tenantMembershipGuard.js";

// GET /api/v1/academia/branding — logo_url y bg_url del centro, nada más.
// Subconjunto deliberado de academia_config: esa ruta (academia.config.routes.js)
// es admin/teacher-only porque expone IBAN, textos de email y franjas
// horarias — no apta para el alumno. Este endpoint existe para que la vista
// del tutor (rol student) pueda pintar el logo/fondo personalizado del
// centro sin abrir el resto de la configuración a ese rol.
export default async function academiaBrandingRoutes(app) {
  const guard = makeTenantMembershipGuard();

  app.get("/", { preHandler: guard.preHandler }, async (req, reply) => {
    const requestId = req.requestId || makeRequestId();
    const tenantSlug = getTenantSlug(req);
    const auth = await requireRole(req, reply, requestId, {
      tenantSlug,
      roles: ["admin", "teacher", "student"],
    });
    if (!auth.ok) return;

    const admin = createSupabaseAdmin();
    const { data, error } = await admin
      .from("academia_config")
      .select("logo_url, bg_url")
      .eq("tenant_id", auth.tenant.id)
      .maybeSingle();

    if (error) {
      req.log.error({ err: error, requestId }, "academia branding fetch failed");
      return fail(reply, 500, "branding_fetch_failed", "Failed to fetch branding", requestId);
    }

    return ok(reply, { branding: { logo_url: data?.logo_url || null, bg_url: data?.bg_url || null } }, requestId);
  });
}
