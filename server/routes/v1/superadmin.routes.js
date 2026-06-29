import { randomBytes } from "crypto";
import { ok, fail } from "../../lib/http.js";
import { createSupabaseAdmin } from "../../lib/supabase.js";
import { sendAdminInviteEmail } from "../../lib/email.js";
import { requireSuperAdmin } from "../../lib/superadminGuard.js";
import { z } from "zod";

function generateTempPassword() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789";
  return Array.from(randomBytes(12)).map(b => chars[b % chars.length]).join("");
}

// ── Schemas ────────────────────────────────────────────────────────────────

const CreateTenantSchema = z.object({
  name: z.string().min(1).max(200),
  slug: z.string().min(1).max(100).regex(/^[a-z0-9-]+$/, "Slug solo puede contener letras minúsculas, números y guiones"),
  type: z.enum(["academia", "standalone", "integrado"]).optional(),
  admin: z.object({
    first_name: z.string().min(1).max(100),
    last_name:  z.string().min(1).max(100),
    email:      z.string().email("Email de administrador inválido"),
    phone:      z.string().max(30).optional(),
  }).optional(),
});

const PatchTenantSchema = z.object({
  name:   z.string().min(1).max(200).optional(),
  type:   z.enum(["academia", "standalone", "integrado"]).optional(),
  status: z.enum(["active", "trial", "inactive", "pending"]).optional(),
}).refine(
  (d) => d.name !== undefined || d.type !== undefined || d.status !== undefined,
  { message: "Se requiere al menos un campo: name, type o status" }
);

const PatchAdminSchema = z.object({
  display_name: z.string().min(1).max(200).optional(),
  email:        z.string().email("Email inválido").optional(),
  phone:        z.string().max(30).optional(),
}).refine(
  (d) => d.display_name !== undefined || d.email !== undefined || d.phone !== undefined,
  { message: "Se requiere al menos un campo: display_name, email o phone" }
);

// ── Routes ─────────────────────────────────────────────────────────────────

export default async function superadminRoutes(app) {

  // GET /api/v1/superadmin/tenants
  app.get("/superadmin/tenants", async (req, reply) => {
    const ctx = await requireSuperAdmin(req, reply);
    if (!ctx) return;
    const { admin, requestId } = ctx;

    const { data: tenants, error } = await admin
      .from("tenants")
      .select("id, slug, name, type, status, created_at")
      .is("deleted_at", null)
      .order("created_at", { ascending: true });

    if (error) {
      return fail(reply, 500, "tenants_fetch_failed", "No se pudieron obtener los centros", requestId);
    }

    const { data: counts, error: countError } = await admin
      .from("tenant_memberships")
      .select("tenant_id")
      .eq("role", "student")
      .eq("status", "active");

    const studentCounts = {};
    if (!countError && counts) {
      for (const row of counts) {
        studentCounts[row.tenant_id] = (studentCounts[row.tenant_id] || 0) + 1;
      }
    }

    const items = (tenants || []).map((t) => ({
      ...t,
      active_students: studentCounts[t.id] || 0,
    }));

    return ok(reply, { items }, requestId);
  });

  // GET /api/v1/superadmin/tenants/:slug/stats — estadísticas para modal de confirmación
  app.get("/superadmin/tenants/:slug/stats", async (req, reply) => {
    const ctx = await requireSuperAdmin(req, reply);
    if (!ctx) return;
    const { admin, requestId } = ctx;
    const { slug } = req.params;

    const { data: tenant } = await admin
      .from("tenants").select("id").eq("slug", slug).is("deleted_at", null).maybeSingle();
    if (!tenant) return fail(reply, 404, "tenant_not_found", "Centro no encontrado", requestId);

    const [studRes, teachRes, taskRes] = await Promise.all([
      // Mismo criterio que el panel admin (admin.dashboard.routes.js): tabla
      // students, approval_status = "approved" — no tenant_memberships.
      admin.from("students").select("id", { count: "exact", head: true })
        .eq("tenant_id", tenant.id).eq("approval_status", "approved"),
      admin.from("tenant_memberships").select("id", { count: "exact", head: true })
        .eq("tenant_id", tenant.id).eq("role", "teacher"),
      admin.from("tasks").select("id", { count: "exact", head: true })
        .eq("tenant_id", tenant.id),
    ]);

    return ok(reply, {
      students: studRes.count || 0,
      teachers: teachRes.count || 0,
      tasks:    taskRes.count || 0,
    }, requestId);
  });

  // DELETE /api/v1/superadmin/tenants/:slug — soft delete (mover a papelera)
  app.delete("/superadmin/tenants/:slug", async (req, reply) => {
    const ctx = await requireSuperAdmin(req, reply);
    if (!ctx) return;
    const { admin, requestId } = ctx;
    const { slug } = req.params;

    const { data: tenant } = await admin
      .from("tenants").select("id").eq("slug", slug).is("deleted_at", null).maybeSingle();
    if (!tenant) return fail(reply, 404, "tenant_not_found", "Centro no encontrado", requestId);

    const { error } = await admin
      .from("tenants")
      .update({ deleted_at: new Date().toISOString() })
      .eq("id", tenant.id);

    if (error) return fail(reply, 500, "delete_failed", "No se pudo mover el centro a la papelera", requestId);

    return ok(reply, { success: true }, requestId);
  });

  // POST /api/v1/superadmin/tenants
  app.post("/superadmin/tenants", async (req, reply) => {
    const ctx = await requireSuperAdmin(req, reply);
    if (!ctx) return;
    const { admin, requestId } = ctx;

    const parsed = CreateTenantSchema.safeParse(req.body);
    if (!parsed.success) {
      return fail(reply, 400, "validation_error", parsed.error.issues[0]?.message || "Datos inválidos", requestId);
    }

    const { name, slug, type } = parsed.data;

    const { data: existing } = await admin
      .from("tenants")
      .select("id")
      .eq("slug", slug)
      .is("deleted_at", null)
      .maybeSingle();

    if (existing) {
      return fail(reply, 409, "slug_taken", "Ya existe un centro activo con ese slug", requestId);
    }

    const insert = { name, slug };
    if (type) insert.type = type;

    const { data: tenant, error } = await admin
      .from("tenants")
      .insert(insert)
      .select("id, slug, name, type, created_at")
      .single();

    if (error) {
      console.error("[superadmin] tenant insert error:", error.message, error.code);
      return fail(reply, 500, "tenant_create_failed", error.message || "No se pudo crear el centro", requestId);
    }

    // ── Crear administrador si se proporcionaron datos ──────────────────────
    const adminData = parsed.data.admin;
    if (!adminData) return ok(reply, { tenant }, requestId);

    let createdUserId = null;
    const rollback = async () => {
      if (createdUserId) {
        const { error: delUserErr } = await admin.auth.admin.deleteUser(createdUserId);
        if (delUserErr) console.error("[rollback] deleteUser failed:", delUserErr.message);
      }
      const { error: delTenantErr } = await admin.from("tenants").delete().eq("id", tenant.id);
      if (delTenantErr) console.error("[rollback] deleteTenant failed:", delTenantErr.message);
    };

    try {
      const displayName = `${adminData.first_name} ${adminData.last_name}`.trim();

      // Pre-check: limpiar usuario previo con este email si no tiene centro activo.
      // Ocurre cuando un centro anterior fue borrado sin purgar su admin,
      // o cuando un intento previo falló a medias.
      const { data: existingUsers } = await admin.rpc(
        "admin_find_user_by_email",
        { p_email: adminData.email }
      );
      const existingUser = existingUsers?.[0] || null;

      if (existingUser) {
        const { data: activeMems } = await admin
          .from("tenant_memberships")
          .select("id, tenant:tenants!inner(id, deleted_at)")
          .eq("user_id", existingUser.user_id)
          .is("tenants.deleted_at", null)
          .limit(1);

        if (activeMems && activeMems.length > 0) {
          await rollback();
          return fail(reply, 409, "email_in_use",
            "Este email ya está en uso por un administrador activo en otro centro.",
            requestId);
        }

        const { error: delErr } = await admin.auth.admin.deleteUser(existingUser.user_id);
        if (delErr) {
          console.error("[superadmin] No se pudo eliminar usuario previo:", delErr.message);
          await rollback();
          return fail(reply, 500, "email_cleanup_failed",
            "El email ya existe en el sistema y no se pudo limpiar. Contacta con soporte.",
            requestId);
        }

        const { data: cleaned } = await admin.rpc(
          "admin_delete_orphaned_identities",
          { p_email: adminData.email }
        );
        if (cleaned?.length) {
          console.warn("[superadmin] Identidades huérfanas eliminadas:", JSON.stringify(cleaned));
        }
      }

      // Contraseña interna aleatoria — el admin la reemplazará via el link de configuración
      const internalPassword = generateTempPassword();

      const { data: authData, error: authErr } = await admin.auth.admin.createUser({
        email: adminData.email,
        password: internalPassword,
        email_confirm: true,
      });
      if (authErr) {
        req.log.error({ err: authErr, requestId }, "admin_user_create_failed: " + authErr.message);
        await rollback();
        return fail(reply, 500, "admin_user_create_failed", authErr.message || "No se pudo crear el usuario admin", requestId);
      }
      createdUserId = authData.user.id;

      const { error: profErr } = await admin.from("profiles").upsert({
        id: createdUserId,
        display_name: displayName,
        phone: adminData.phone || null,
        must_change_password: true,
      }, { onConflict: "id" });
      if (profErr) {
        req.log.error({ err: profErr, requestId }, "profile_create_failed: " + profErr.message);
        await rollback();
        return fail(reply, 500, "profile_create_failed", profErr.message || "No se pudo crear el perfil del admin", requestId);
      }

      const { error: memErr } = await admin.from("tenant_memberships").insert({
        user_id: createdUserId,
        tenant_id: tenant.id,
        role: "admin",
        status: "active",
      });
      if (memErr) {
        req.log.error({ err: memErr, requestId }, "membership_create_failed: " + memErr.message);
        await rollback();
        return fail(reply, 500, "membership_create_failed", memErr.message || "No se pudo asignar el admin al centro", requestId);
      }

      const { data: linkData, error: linkErr } = await admin.auth.admin.generateLink({
        type: "recovery",
        email: adminData.email,
        options: { redirectTo: "https://tutordigital.app/change-password.html" },
      });
      if (linkErr || !linkData?.properties?.action_link) {
        req.log.error({ err: linkErr, requestId }, "generate_link_failed: " + linkErr?.message);
        await rollback();
        return fail(reply, 500, "generate_link_failed",
          "No se pudo generar el enlace de configuración. Inténtalo de nuevo.",
          requestId);
      }

      sendAdminInviteEmail({ to: adminData.email, tenantName: name, setupLink: linkData.properties.action_link })
        .catch(e => console.error("[superadmin] Email invite failed:", e.message));

      return ok(reply, { tenant, admin_created: true }, requestId);
    } catch (err) {
      console.error("[superadmin] create_tenant error:", err?.message, "\n", err?.stack);
      req.log.error({ err, stack: err?.stack, requestId }, "create_tenant_catch: " + err?.message);
      await rollback();
      return fail(reply, 500, "create_failed", err?.message || "Error inesperado al crear el centro", requestId);
    }
  });

  // PATCH /api/v1/superadmin/tenants/:slug
  app.patch("/superadmin/tenants/:slug", async (req, reply) => {
    const ctx = await requireSuperAdmin(req, reply);
    if (!ctx) return;
    const { admin, requestId } = ctx;
    const { slug } = req.params;

    const parsed = PatchTenantSchema.safeParse(req.body);
    if (!parsed.success) {
      return fail(reply, 400, "validation_error", parsed.error.issues[0]?.message || "Datos inválidos", requestId);
    }

    const { data: tenant } = await admin
      .from("tenants").select("id").eq("slug", slug).is("deleted_at", null).maybeSingle();
    if (!tenant) return fail(reply, 404, "tenant_not_found", "Centro no encontrado", requestId);

    const { error } = await admin
      .from("tenants").update(parsed.data).eq("id", tenant.id);
    if (error) return fail(reply, 500, "tenant_update_failed", "No se pudo actualizar el centro", requestId);

    return ok(reply, { success: true, updated: parsed.data }, requestId);
  });

  // GET /api/v1/superadmin/tenants/:slug/admin
  app.get("/superadmin/tenants/:slug/admin", async (req, reply) => {
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
    if (!membership) return fail(reply, 404, "admin_not_found", "No hay administrador activo", requestId);

    const userId = membership.user_id;
    const [{ data: profile }, { data: authData }] = await Promise.all([
      admin.from("profiles").select("display_name, phone").eq("id", userId).maybeSingle(),
      admin.auth.admin.getUserById(userId),
    ]);

    return ok(reply, {
      display_name: profile?.display_name || null,
      email:        authData?.user?.email  || null,
      phone:        profile?.phone         || null,
    }, requestId);
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

    const { data: tenant } = await admin
      .from("tenants").select("id").eq("slug", slug).is("deleted_at", null).maybeSingle();
    if (!tenant) return fail(reply, 404, "tenant_not_found", "Centro no encontrado", requestId);

    const { data: membership } = await admin
      .from("tenant_memberships").select("user_id")
      .eq("tenant_id", tenant.id).eq("role", "admin").eq("status", "active")
      .limit(1).maybeSingle();
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
