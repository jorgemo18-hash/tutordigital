import { makeRequestId } from "./requestId.js";
import { requireAuth } from "./auth.js";
import { createSupabaseAdmin } from "./supabase.js";
import { fail } from "./http.js";

/**
 * Verifica que el usuario autenticado tiene is_superadmin = true.
 * Devuelve { auth, admin, requestId } o null (y ya ha respondido con error).
 */
export async function requireSuperAdmin(req, reply) {
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
