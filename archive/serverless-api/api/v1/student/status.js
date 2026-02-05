import { makeRequestId } from "../_lib/requestId.js";
import { ok, fail } from "../_lib/http.js";
import { rateLimit } from "../_lib/rateLimit.js";
import { requireAuth } from "../_lib/auth.js";
import { getTenantSlug } from "../_lib/tenantSlug.js";
import { createSupabaseAdmin } from "../_lib/supabase.js";
import { getMembership, roleAllowed } from "../_lib/auth.js";

export default async function handler(req, res) {
  const requestId = makeRequestId();
  if (req.method !== "GET") {
    return fail(res, 405, "method_not_allowed", "Method not allowed", requestId);
  }

  const auth = await requireAuth(req);
  if (!auth.ok) {
    return fail(res, 401, "unauthorized", "Unauthorized", requestId);
  }

  const tenantSlug = getTenantSlug(req);
  if (!tenantSlug) {
    return fail(res, 400, "tenant_slug_required", "Tenant slug required", requestId);
  }

  const admin = createSupabaseAdmin();
  const { data: tenant, error: tenantErr } = await admin
    .from("tenants")
    .select("id, slug, name")
    .eq("slug", tenantSlug)
    .maybeSingle();
  if (tenantErr || !tenant) {
    return fail(res, 404, "tenant_not_found", "Tenant not found", requestId);
  }

  const { membership } = await getMembership({ userId: auth.user.id, tenantId: tenant.id });
  if (!membership || membership.status !== "active") {
    return fail(res, 403, "tenant_forbidden", "Tenant forbidden", requestId);
  }
  if (!roleAllowed(membership.role, ["student"])) {
    return fail(res, 403, "role_forbidden", "Role forbidden", requestId);
  }

  const rl = await rateLimit(req, {
    limit: 60,
    windowSec: 60,
    userId: auth.user.id,
    tenantId: tenant.id,
  });
  res.setHeader("x-ratelimit-limit", rl.limit);
  res.setHeader("x-ratelimit-remaining", rl.remaining);
  if (!rl.ok) return fail(res, 429, "rate_limited", "Too many requests", requestId);

  const { data, error } = await admin
    .from("students")
    .select("id, display_name, group_id, approval_status, status")
    .eq("tenant_id", tenant.id)
    .eq("user_id", auth.user.id)
    .maybeSingle();

  if (error || !data) {
    return fail(res, 404, "student_not_found", "Student not found", requestId);
  }

  return ok(res, { student: data }, requestId);
}
