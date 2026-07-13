import { makeRequestId } from "../../lib/requestId.js";
import { ok, fail } from "../../lib/http.js";
import { requireAuth } from "../../lib/auth.js";
import { rateLimit } from "../../lib/rateLimit.js";
import { createSupabaseAdmin } from "../../lib/supabase.js";
import { autoRedeemInvites } from "../../lib/teacherUtils.js";

export default async function meHandler(req, reply) {
  const requestId = req.requestId || makeRequestId();
  if (req.method !== "GET") {
    return fail(reply, 405, "method_not_allowed", "Method not allowed", requestId);
  }

  const auth = req.user
    ? { ok: true, user: req.user, token: "" }
    : await requireAuth(req);
  if (!auth.ok) {
    const rl = await rateLimit(req, { limit: 30, windowSec: 60 });
    reply.header("x-ratelimit-limit", rl.limit);
    reply.header("x-ratelimit-remaining", rl.remaining);
    return fail(reply, 401, "unauthorized", "Unauthorized", requestId);
  }

  const rl = await rateLimit(req, { limit: 120, windowSec: 60, userId: auth.user.id });
  reply.header("x-ratelimit-limit", rl.limit);
  reply.header("x-ratelimit-remaining", rl.remaining);
  if (!rl.ok) {
    return fail(reply, 429, "rate_limited", "Too many requests", requestId);
  }

  const admin = createSupabaseAdmin();

  // Intentar canjear invitaciones pendientes cada vez que se carga el perfil
  const email = String(auth.user.email || "").trim().toLowerCase();
  await autoRedeemInvites(admin, auth.user.id, email);

  const { data, error: dbError } = await admin
    .from("tenant_memberships")
    .select("id, role, status, tenant:tenants(id, slug, name, type)")
    .eq("user_id", auth.user.id)
    .order("created_at", { ascending: true });

  if (dbError) {
    return fail(reply, 500, "membership_lookup_failed", "Membership lookup failed", requestId);
  }

  const { data: teacherRequests, error: teacherReqErr } = await admin
    .from("teacher_requests")
    .select("id, status, created_at, tenant:tenants(id, slug, name)")
    .eq("requested_by", auth.user.id)
    .order("created_at", { ascending: false });

  if (teacherReqErr) {
    return fail(reply, 500, "teacher_request_lookup_failed", "Teacher request lookup failed", requestId, undefined, teacherReqErr);
  }

  // /me es deliberadamente tenant-agnóstico (lista memberships de TODOS los
  // tenants del usuario) — no hay un tenant_slug/tenant_id de este request
  // que filtrar aquí. Si el mismo usuario tiene teacher_profiles en más de
  // un tenant, maybeSingle() sin más devolvería una fila arbitraria; se pide
  // explícitamente la más reciente (created_at desc) en su lugar, para que
  // el resultado sea determinista en vez de depender del orden interno de la BD.
  const { data: teacherProfile } = await admin
    .from("teacher_profiles")
    .select("display_name")
    .eq("user_id", auth.user.id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const { data: profile } = await admin
    .from("profiles")
    .select("is_superadmin, display_name, must_change_password")
    .eq("id", auth.user.id)
    .maybeSingle();

  return ok(
    reply,
    {
      user: {
        id: auth.user.id,
        email: auth.user.email || null,
        display_name: teacherProfile?.display_name || profile?.display_name || null,
        is_superadmin: profile?.is_superadmin === true,
        must_change_password: profile?.must_change_password === true,
      },
      memberships: data || [],
      teacher_requests: teacherRequests || [],
      teacher_request_status: teacherRequests?.[0]?.status || null,
      needs_join: !data || data.length === 0,
    },
    requestId
  );
}
