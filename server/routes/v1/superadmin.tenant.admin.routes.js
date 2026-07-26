import { ok, fail } from "../../lib/http.js";
import { requireSuperAdmin } from "../../lib/superadminGuard.js";
import { fetchNombresDePerfilesConFallback } from "../../lib/profileDisplayName.js";
import { z } from "zod";

const PatchAdminSchema = z.object({
  display_name: z.string().min(1).max(200).optional(),
  email:        z.string().email("Email inválido").optional(),
  phone:        z.string().max(30).optional(),
}).refine(
  (d) => d.display_name !== undefined || d.email !== undefined || d.phone !== undefined,
  { message: "Se requiere al menos un campo: display_name, email o phone" }
);

async function findTenantBySlug(admin, slug) {
  const { data } = await admin
    .from("tenants").select("id").eq("slug", slug).is("deleted_at", null).maybeSingle();
  return data || null;
}

async function findActiveAdminMembership(admin, tenantId) {
  const { data } = await admin
    .from("tenant_memberships").select("user_id")
    .eq("tenant_id", tenantId).eq("role", "admin").eq("status", "active")
    .limit(1).maybeSingle();
  return data || null;
}

// display_name con el mismo fallback a teacher_profiles que
// fetchTrabajadoresDelTenant/fetchNombreTrabajador (ver
// profileDisplayName.js): profiles.display_name no está garantizado para
// un profesor, y antes esta ruta lo dejaba en null sin más. email sale de
// auth (profiles no lo guarda); phone tal cual está en profiles.
export async function resolveTenantAdminInfo(admin, tenantSlug, userId) {
  const [nombresPorId, { data: profile }, { data: authData }] = await Promise.all([
    fetchNombresDePerfilesConFallback(admin, tenantSlug, [userId]),
    admin.from("profiles").select("phone").eq("id", userId).maybeSingle(),
    admin.auth.admin.getUserById(userId),
  ]);
  return {
    display_name: nombresPorId.get(userId) || "Sin nombre",
    email:        authData?.user?.email  || null,
    phone:        profile?.phone         || null,
  };
}

// ── Routes ─────────────────────────────────────────────────────────────────
// Lectura y edición del administrador (usuario) de un centro — distinto
// del propio centro (ver superadmin.routes.js) y de la suplantación (ver
// superadmin.tenant.actions.routes.js).

export default async function superadminTenantAdminRoutes(app) {

  // GET /api/v1/superadmin/tenants/:slug/admin
  app.get("/superadmin/tenants/:slug/admin", async (req, reply) => {
    const ctx = await requireSuperAdmin(req, reply);
    if (!ctx) return;
    const { admin, requestId } = ctx;
    const { slug } = req.params;

    const tenant = await findTenantBySlug(admin, slug);
    if (!tenant) return fail(reply, 404, "tenant_not_found", "Centro no encontrado", requestId);

    const membership = await findActiveAdminMembership(admin, tenant.id);
    if (!membership) return fail(reply, 404, "admin_not_found", "No hay administrador activo", requestId);

    const info = await resolveTenantAdminInfo(admin, slug, membership.user_id);
    return ok(reply, info, requestId);
  });

  // PATCH /api/v1/superadmin/tenants/:slug/admin
  app.patch("/superadmin/tenants/:slug/admin", async (req, reply) => {
    const ctx = await requireSuperAdmin(req, reply);
    if (!ctx) return;
    const { admin, requestId } = ctx;
    const { slug } = req.params;

    const parsed = PatchAdminSchema.safeParse(req.body);
    if (!parsed.success) {
      return fail(reply, 400, "validation_error", parsed.error.issues[0]?.message || "Datos inválidos", requestId);
    }
    const { display_name, email, phone } = parsed.data;

    const tenant = await findTenantBySlug(admin, slug);
    if (!tenant) return fail(reply, 404, "tenant_not_found", "Centro no encontrado", requestId);

    const membership = await findActiveAdminMembership(admin, tenant.id);
    if (!membership) return fail(reply, 404, "admin_not_found", "No hay un administrador activo en este centro", requestId);

    const userId  = membership.user_id;
    const updated = {};

    const profilePatch = {};
    if (display_name !== undefined) profilePatch.display_name = display_name;
    if (phone !== undefined) profilePatch.phone = phone || null;
    if (Object.keys(profilePatch).length) {
      const { error: profErr } = await admin
        .from("profiles").update(profilePatch).eq("id", userId);
      if (profErr) return fail(reply, 500, "profile_update_failed", "No se pudo actualizar el perfil", requestId);
      Object.assign(updated, profilePatch);
    }

    if (email !== undefined) {
      const { error: authErr } = await admin.auth.admin.updateUserById(userId, { email });
      if (authErr) return fail(reply, 500, "email_update_failed", authErr.message || "No se pudo actualizar el email", requestId);
      updated.email = email;
    }

    return ok(reply, { success: true, updated }, requestId);
  });
}
