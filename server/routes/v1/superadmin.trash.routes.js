import { ok, fail } from "../../lib/http.js";
import { requireSuperAdmin } from "../../lib/superadminGuard.js";
import { purgeTenant } from "../../lib/superadminTenantPurge.js";

const TTL_DAYS = 30;

export default async function superadminTrashRoutes(app) {

  // GET /api/v1/superadmin/tenants/trash — lista de centros en papelera
  app.get("/superadmin/tenants/trash", async (req, reply) => {
    const ctx = await requireSuperAdmin(req, reply);
    if (!ctx) return;
    const { admin, requestId } = ctx;

    const { data: tenants, error } = await admin
      .from("tenants")
      .select("id, slug, name, type, deleted_at")
      .not("deleted_at", "is", null)
      .order("deleted_at", { ascending: false });

    if (error) {
      return fail(reply, 500, "trash_fetch_failed", "No se pudo obtener la papelera", requestId);
    }

    const now = Date.now();
    const items = (tenants || []).map(t => {
      const daysElapsed = Math.floor((now - new Date(t.deleted_at).getTime()) / 86400000);
      return { ...t, days_remaining: Math.max(0, TTL_DAYS - daysElapsed) };
    });

    return ok(reply, { items }, requestId);
  });

  // POST /api/v1/superadmin/tenants/:slug/restore — restaurar desde papelera
  app.post("/superadmin/tenants/:slug/restore", async (req, reply) => {
    const ctx = await requireSuperAdmin(req, reply);
    if (!ctx) return;
    const { admin, requestId } = ctx;
    const { slug } = req.params;

    const { data: tenant } = await admin
      .from("tenants").select("id").eq("slug", slug).not("deleted_at", "is", null).maybeSingle();
    if (!tenant) {
      return fail(reply, 404, "tenant_not_found", "Centro no encontrado en la papelera", requestId);
    }

    const { error } = await admin
      .from("tenants").update({ deleted_at: null }).eq("id", tenant.id);
    if (error) return fail(reply, 500, "restore_failed", "No se pudo restaurar el centro", requestId);

    return ok(reply, { success: true }, requestId);
  });

  // DELETE /api/v1/superadmin/tenants/:slug/purge — eliminación definitiva en cascada
  app.delete("/superadmin/tenants/:slug/purge", async (req, reply) => {
    const ctx = await requireSuperAdmin(req, reply);
    if (!ctx) return;
    const { admin, requestId } = ctx;
    const { slug } = req.params;

    const { data: tenant } = await admin
      .from("tenants").select("id").eq("slug", slug).not("deleted_at", "is", null).maybeSingle();
    if (!tenant) {
      return fail(reply, 404, "tenant_not_found", "Centro no encontrado en la papelera", requestId);
    }

    try {
      const result = await purgeTenant(tenant.id);
      return ok(reply, { success: true, deleted_users: result.deletedUsers }, requestId);
    } catch (err) {
      console.error("[purge] Error:", err.message);
      return fail(reply, 500, "purge_failed", "Error al eliminar definitivamente el centro", requestId);
    }
  });
}
