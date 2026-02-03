import { createSupabaseAdmin, createSupabaseUserClient, getBearerToken } from "./supabase.js";

export async function getAuthUser(req) {
  const token = getBearerToken(req);
  if (!token) return { user: null, token: "" };
  const client = createSupabaseUserClient(token);
  const { data, error } = await client.auth.getUser();
  if (error || !data?.user) return { user: null, token };
  return { user: data.user, token };
}

export async function requireAuth(req) {
  const { user, token } = await getAuthUser(req);
  if (!user) {
    return { ok: false, user: null, token: "" };
  }
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
  return { membership: data || null, error: null };
}

export function roleAllowed(role = "", allowed = []) {
  if (!allowed || !allowed.length) return true;
  return allowed.includes(role);
}
