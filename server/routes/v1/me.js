import { makeRequestId } from "../../lib/requestId.js";
import { ok, fail } from "../../lib/http.js";
import { requireAuth } from "../../lib/auth.js";
import { rateLimit } from "../../lib/rateLimit.js";
import { createSupabaseAdmin } from "../../lib/supabase.js";

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
  const { data, error: dbError } = await admin
    .from("tenant_memberships")
    .select("id, role, status, tenant:tenants(id, slug, name)")
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
    return fail(reply, 500, "teacher_request_lookup_failed", "Teacher request lookup failed", requestId);
  }

  return ok(
    reply,
    {
      user: {
        id: auth.user.id,
        email: auth.user.email || null,
      },
      memberships: data || [],
      teacher_requests: teacherRequests || [],
      teacher_request_status: teacherRequests?.[0]?.status || null,
      needs_join: !data || data.length === 0,
    },
    requestId
  );
}
