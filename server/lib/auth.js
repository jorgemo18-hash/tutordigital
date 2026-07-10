import { createSupabaseAdmin, getBearerToken } from "./supabase.js";
import { verifySupabaseJwt } from "./supabaseJwt.js";
import { Sentry } from "./sentry.js";

export async function getAuthUser(req) {
  const token = getBearerToken(req);
  if (!token) return { user: null, token: "" };
  try {
    const payload = await verifySupabaseJwt(token);
    const user = {
      id: String(payload?.sub || ""),
      email: payload?.email || null,
      role: payload?.role || null,
      payload,
    };
    if (!user.id) return { user: null, token };
    req.user = user;
    return { user, token };
  } catch {
    return { user: null, token };
  }
}

export async function requireAuth(req) {
  const { user, token } = await getAuthUser(req);
  if (!user) {
    return { ok: false, user: null, token: "" };
  }
  Sentry.setUser({ id: user.id, email: user.email || undefined });
  return { ok: true, user, token };
}

export async function getMembership({ userId, tenantId }) {
  const admin = createSupabaseAdmin();
  const { data, error } = await admin
    .from("tenant_memberships")
    .select("id, role, status")
    .eq("user_id", userId)
    .eq("tenant_id", tenantId)
    .maybeSingle();
  if (error) return { membership: null, error };
  if (data) {
    // Sentry.setUser() escribe en la isolation scope (una por request, ver
    // http integration) y reemplaza el objeto entero — se combina con lo que
    // ya puso requireAuth() (id/email) para no perderlo en el evento.
    const prevUser = Sentry.getIsolationScope().getUser() || {};
    Sentry.setUser({ ...prevUser, id: userId, tenant: tenantId, role: data.role });
  }
  return { membership: data || null, error: null };
}

export function roleAllowed(role = "", allowed = []) {
  if (!allowed || !allowed.length) return true;
  return allowed.includes(role);
}
