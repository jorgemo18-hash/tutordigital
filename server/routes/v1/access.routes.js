import { makeRequestId } from "../../lib/requestId.js";
import { ok, fail } from "../../lib/http.js";
import { rateLimit } from "../../lib/rateLimit.js";
import { requireAuth, getMembership } from "../../lib/auth.js";
import { getTenantSlug } from "../../lib/tenantSlug.js";
import { createSupabaseAdmin } from "../../lib/supabase.js";

function methodNotAllowed(reply, requestId) {
  return fail(reply, 405, "method_not_allowed", "Method not allowed", requestId);
}

export default async function accessRoutes(app) {
  app.route({
    method: ["GET", "POST", "PATCH", "PUT", "DELETE", "OPTIONS", "HEAD"],
    url: "/tenant/join",
    handler: async (req, reply) => {
      const requestId = req.requestId || makeRequestId();
      if (req.method !== "POST") return methodNotAllowed(reply, requestId);

      // Flujo desactivado — los alumnos deben registrarse desde student-register.html
      return fail(reply, 410, "flow_disabled", "Este flujo está desactivado. Usa el enlace de registro de tu grupo.", requestId);
    },
  });

  app.route({
    method: ["GET", "POST", "PATCH", "PUT", "DELETE", "OPTIONS", "HEAD"],
    url: "/student/status",
    handler: async (req, reply) => {
      const requestId = req.requestId || makeRequestId();
      if (req.method !== "GET") return methodNotAllowed(reply, requestId);

      const auth = await requireAuth(req);
      if (!auth.ok) return fail(reply, 401, "unauthorized", "Unauthorized", requestId);

      const tenantSlug = getTenantSlug(req);
      if (!tenantSlug) {
        return fail(reply, 400, "tenant_slug_required", "Tenant slug required", requestId);
      }

      const admin = createSupabaseAdmin();
      const { data: tenant, error: tenantErr } = await admin
        .from("tenants")
        .select("id, slug, name")
        .eq("slug", tenantSlug)
        .is("deleted_at", null)
        .maybeSingle();
      if (tenantErr || !tenant) {
        return fail(reply, 404, "tenant_not_found", "Tenant not found", requestId);
      }

      const { membership } = await getMembership({ userId: auth.user.id, tenantId: tenant.id });
      if (!membership) {
        return fail(reply, 403, "tenant_forbidden", "Tenant forbidden", requestId);
      }
      if (membership.role !== "student") {
        return fail(reply, 403, "role_forbidden", "Role forbidden", requestId);
      }

      const rl = await rateLimit(req, {
        limit: 60,
        windowSec: 60,
        userId: auth.user.id,
        tenantId: tenant.id,
      });
      reply.header("x-ratelimit-limit", rl.limit);
      reply.header("x-ratelimit-remaining", rl.remaining);
      if (!rl.ok) return fail(reply, 429, "rate_limited", "Too many requests", requestId);

      const { data: student, error: studentErr } = await admin
        .from("students")
        .select("id, display_name, group_id, approval_status, status, group:groups(name)")
        .eq("tenant_id", tenant.id)
        .eq("user_id", auth.user.id)
        .maybeSingle();

      if (studentErr || !student) {
        return fail(reply, 404, "student_not_found", "Student not found", requestId);
      }

      return ok(reply, { student }, requestId);
    },
  });
}
