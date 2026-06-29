import { ok, fail } from "../../lib/http.js";
import { requireSuperAdmin } from "../../lib/superadminGuard.js";

// ── Routes ─────────────────────────────────────────────────────────────────
// Acciones puntuales sobre un centro que no son ni CRUD del tenant
// (superadmin.routes.js) ni gestión de su admin (superadmin.tenant.admin.routes.js).

export default async function superadminTenantActionsRoutes(app) {

  // POST /api/v1/superadmin/tenants/:slug/impersonate
  app.post("/superadmin/tenants/:slug/impersonate", async (req, reply) => {
    const ctx = await requireSuperAdmin(req, reply);
    if (!ctx) return;
    const { admin, requestId } = ctx;
    const { slug } = req.params;

    const { data: tenant } = await admin
      .from("tenants").select("id").eq("slug", slug).is("deleted_at", null).maybeSingle();
    if (!tenant) return fail(reply, 404, "tenant_not_found", "Centro no encontrado", requestId);

    const { data: membership } = await admin
      .from("tenant_memberships").select("user_id")
      .eq("tenant_id", tenant.id).eq("role", "admin").eq("status", "active")
      .limit(1).maybeSingle();
    if (!membership) return fail(reply, 404, "admin_not_found", "No hay administrador activo en este centro", requestId);

    const { data: authUser, error: getUserErr } = await admin.auth.admin.getUserById(membership.user_id);
    if (getUserErr || !authUser?.user?.email) {
      return fail(reply, 500, "user_lookup_failed", "No se pudo obtener el email del administrador", requestId);
    }

    const redirectTo = `https://tutordigital.app/auth/callback?impersonating=true&tenant=${encodeURIComponent(slug)}`;
    const { data: linkData, error: linkErr } = await admin.auth.admin.generateLink({
      type: "magiclink",
      email: authUser.user.email,
      options: { redirectTo },
    });

    if (linkErr || !linkData?.properties?.action_link) {
      return fail(reply, 500, "generate_link_failed", linkErr?.message || "No se pudo generar el enlace", requestId);
    }

    return ok(reply, { url: linkData.properties.action_link }, requestId);
  });

  // POST /api/v1/superadmin/tenants/:slug/approve
  app.post("/superadmin/tenants/:slug/approve", async (req, reply) => {
    const ctx = await requireSuperAdmin(req, reply);
    if (!ctx) return;
    const { admin, requestId } = ctx;

    const slug = req.params?.slug;
    if (!slug) return fail(reply, 400, "invalid_params", "Slug requerido", requestId);

    const { data: tenant, error: fetchErr } = await admin
      .from("tenants")
      .select("id, slug, name, status")
      .eq("slug", slug)
      .is("deleted_at", null)
      .maybeSingle();

    if (fetchErr) return fail(reply, 500, "tenant_lookup_failed", "No se pudo obtener el centro", requestId);
    if (!tenant)  return fail(reply, 404, "tenant_not_found", "Centro no encontrado", requestId);
    if (tenant.status !== "pending") {
      return fail(reply, 409, "not_pending", "El centro no está en estado pendiente", requestId);
    }

    const { error: updateErr } = await admin
      .from("tenants")
      .update({ status: "active" })
      .eq("id", tenant.id);

    if (updateErr) return fail(reply, 500, "approve_failed", "No se pudo aprobar el centro", requestId);

    req.log.info({ requestId, tenantId: tenant.id, slug }, "tenant approved");
    return ok(reply, { tenant: { id: tenant.id, slug, name: tenant.name, status: "active" } }, requestId);
  });
}
