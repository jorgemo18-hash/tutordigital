import { makeRequestId } from "../../lib/requestId.js";
import { ok, fail } from "../../lib/http.js";
import { requireAuth } from "../../lib/auth.js";
import { createSupabaseAdmin } from "../../lib/supabase.js";
import { z } from "zod";

// ── Guard ──────────────────────────────────────────────────────────────────

async function requireSuperAdmin(req, reply) {
  const requestId = req.requestId || makeRequestId();
  const auth = req.user
    ? { ok: true, user: req.user }
    : await requireAuth(req);

  if (!auth.ok) {
    fail(reply, 401, "unauthorized", "Unauthorized", requestId);
    return null;
  }

  const admin = createSupabaseAdmin();
  const { data: profile } = await admin
    .from("profiles")
    .select("is_superadmin")
    .eq("id", auth.user.id)
    .maybeSingle();

  if (profile?.is_superadmin !== true) {
    fail(reply, 403, "forbidden", "Forbidden", requestId);
    return null;
  }

  return { auth, admin, requestId };
}

// ── Schemas ────────────────────────────────────────────────────────────────

const CreateTenantSchema = z.object({
  name: z.string().min(1).max(200),
  slug: z.string().min(1).max(100).regex(/^[a-z0-9-]+$/, "Slug solo puede contener letras minúsculas, números y guiones"),
  type: z.enum(["academia", "instituto", "colegio", "otro"]).optional(),
});

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
      .select("id, slug, name, type, created_at")
      .order("created_at", { ascending: true });

    if (error) {
      return fail(reply, 500, "tenants_fetch_failed", "No se pudieron obtener los centros", requestId);
    }

    // Count active students per tenant
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
      .maybeSingle();

    if (existing) {
      return fail(reply, 409, "slug_taken", "Ya existe un centro con ese slug", requestId);
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

    return ok(reply, { tenant }, requestId);
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

    // 1. Buscar tenant
    const { data: tenant } = await admin
      .from("tenants")
      .select("id")
      .eq("slug", slug)
      .maybeSingle();

    if (!tenant) {
      return fail(reply, 404, "tenant_not_found", "Centro no encontrado", requestId);
    }

    // 2. Buscar el admin del tenant
    const { data: membership } = await admin
      .from("tenant_memberships")
      .select("user_id")
      .eq("tenant_id", tenant.id)
      .eq("role", "admin")
      .eq("status", "active")
      .limit(1)
      .maybeSingle();

    if (!membership) {
      return fail(reply, 404, "admin_not_found", "No hay un administrador activo en este centro", requestId);
    }

    const userId  = membership.user_id;
    const updated = {};

    // 3. Actualizar display_name en profiles
    if (display_name) {
      const { error: profErr } = await admin
        .from("profiles")
        .update({ display_name })
        .eq("id", userId);

      if (profErr) {
        return fail(reply, 500, "profile_update_failed", "No se pudo actualizar el nombre", requestId);
      }
      updated.display_name = display_name;
    }

    // 4. Actualizar email en auth.users (nunca profiles.email directamente)
    if (email) {
      const { error: authErr } = await admin.auth.admin.updateUserById(userId, { email });

      if (authErr) {
        return fail(reply, 500, "email_update_failed", authErr.message || "No se pudo actualizar el email", requestId);
      }
      updated.email = email;
    }

    return ok(reply, { success: true, updated }, requestId);
  });
}
