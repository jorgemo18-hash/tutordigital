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
  type: z.enum(["academia", "instituto", "colegio", "otro"]).optional(),
  admin: z.object({
    first_name: z.string().min(1).max(100),
    last_name:  z.string().min(1).max(100),
    email:      z.string().email("Email de administrador inválido"),
    phone:      z.string().max(30).optional(),
  }).optional(),
});

const PatchTenantSchema = z.object({
  name:   z.string().min(1).max(200).optional(),
  type:   z.enum(["academia", "instituto", "colegio", "otro"]).optional(),
  status: z.enum(["active", "trial", "inactive"]).optional(),
}).refine(
  (d) => d.name !== undefined || d.type !== undefined || d.status !== undefined,
  { message: "Se requiere al menos un campo: name, type o status" }
);

const PatchAdminSchema = z.object({
  display_name: z.string().min(1).max(200).optional(),
  email:        z.string().email("Email inválido").optional(),
}).refine(
  (d) => d.display_name !== undefined || d.email !== undefined,
  { message: "Se requiere al menos un campo: display_name o email" }
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
      admin.from("tenant_memberships").select("id", { count: "exact", head: true })
        .eq("tenant_id", tenant.id).eq("role", "student"),
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
      return fail(reply, 500, "tenant_create_failed", "No se pudo crear el centro", requestId);
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
      const tempPassword = generateTempPassword();
      const displayName  = `${adminData.first_name} ${adminData.last_name}`.trim();

      const { data: authData, error: authErr } = await admin.auth.admin.createUser({
        email: adminData.email,
        password: tempPassword,
        email_confirm: true,
      });
      if (authErr) {
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
        await rollback();
        return fail(reply, 500, "profile_create_failed", "No se pudo crear el perfil del admin", requestId);
      }

      const { error: memErr } = await admin.from("tenant_memberships").insert({
        user_id: createdUserId,
        tenant_id: tenant.id,
        role: "admin",
        status: "active",
      });
      if (memErr) {
        await rollback();
        return fail(reply, 500, "membership_create_failed", "No se pudo asignar el admin al centro", requestId);
      }

      sendAdminInviteEmail({ to: adminData.email, tenantName: name, tempPassword })
        .catch(e => console.error("[superadmin] Email invite failed:", e.message));

      return ok(reply, { tenant, admin_created: true }, requestId);
    } catch (err) {
      await rollback();
      return fail(reply, 500, "create_failed", "Error inesperado al crear el centro", requestId);
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
    const { display_name, email } = parsed.data;

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

    if (display_name) {
      const { error: profErr } = await admin
        .from("profiles").update({ display_name }).eq("id", userId);
      if (profErr) return fail(reply, 500, "profile_update_failed", "No se pudo actualizar el nombre", requestId);
      updated.display_name = display_name;
    }

    if (email) {
      const { error: authErr } = await admin.auth.admin.updateUserById(userId, { email });
      if (authErr) return fail(reply, 500, "email_update_failed", authErr.message || "No se pudo actualizar el email", requestId);
      updated.email = email;
    }

    return ok(reply, { success: true, updated }, requestId);
  });
}
