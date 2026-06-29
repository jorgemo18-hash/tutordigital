import { ok, fail } from "../../lib/http.js";
import { requireSuperAdmin } from "../../lib/superadminGuard.js";
import { z } from "zod";

// ── Schemas ────────────────────────────────────────────────────────────────

const PatchTenantSchema = z.object({
  name:   z.string().min(1).max(200).optional(),
  type:   z.enum(["academia", "standalone", "integrado"]).optional(),
  status: z.enum(["active", "trial", "inactive", "pending"]).optional(),
}).refine(
  (d) => d.name !== undefined || d.type !== undefined || d.status !== undefined,
  { message: "Se requiere al menos un campo: name, type o status" }
);

// ── Routes ─────────────────────────────────────────────────────────────────
// CRUD básico de centros (listar, ver stats para el modal de borrado,
// actualizar, mover a papelera). La creación (con su lógica de admin +
// invitación) vive en superadmin.tenant.create.routes.js; la gestión del
// admin del centro en superadmin.tenant.admin.routes.js; y suplantación +
// aprobación en superadmin.tenant.actions.routes.js.

export default async function superadminRoutes(app) {

  // GET /api/v1/superadmin/tenants
  app.get("/superadmin/tenants", async (req, reply) => {
    const ctx = await requireSuperAdmin(req, reply);
    if (!ctx) return;
    const { admin, requestId } = ctx;

    const { data: tenants, error } = await admin
      .from("tenants")
      .select("id, slug, name, type, status, regimen_fiscal, sector, created_at")
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
}
