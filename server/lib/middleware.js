import { fail } from "./http.js";
import { requireAuth } from "./auth.js";
import { resolveTenantForUser } from "./tenant.js";

export async function requireAuthMiddleware(req, reply, requestId) {
  const auth = await requireAuth(req);
  if (!auth.ok) {
    fail(reply, 401, "unauthorized", "Unauthorized", requestId);
    return { ok: false, user: null, token: "" };
  }
  return { ok: true, user: auth.user, token: auth.token };
}

export async function resolveTenant(req, reply, requestId, {
  tenantSlug,
  allowedRoles = [],
} = {}) {
  const auth = await requireAuthMiddleware(req, reply, requestId);
  if (!auth.ok) return { ok: false };

  const resolved = await resolveTenantForUser({
    userId: auth.user.id,
    tenantSlug,
    allowedRoles,
  });

  if (!resolved.ok) {
    const status = resolved.status || 403;
    fail(reply, status, resolved.error || "tenant_forbidden", "Tenant forbidden", requestId);
    return { ok: false };
  }

  return {
    ok: true,
    user: auth.user,
    tenant: resolved.tenant,
    membership: resolved.membership,
  };
}

export async function requireRole(req, reply, requestId, {
  tenantSlug,
  roles = [],
} = {}) {
  return resolveTenant(req, reply, requestId, {
    tenantSlug,
    allowedRoles: roles,
  });
}
