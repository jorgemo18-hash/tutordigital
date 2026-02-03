import { z } from "zod";
import { makeRequestId } from "./_lib/requestId.js";
import { error, json } from "./_lib/response.js";
import { requireAuth } from "./_lib/auth.js";
import { rateLimit } from "./_lib/rateLimit.js";
import { createSupabaseAdmin } from "./_lib/supabase.js";

const QuerySchema = z.object({}).passthrough();

export default async function handler(req, res) {
  const requestId = makeRequestId();
  if (req.method !== "GET") {
    return error(res, 405, "Method not allowed", "method_not_allowed", requestId);
  }

  QuerySchema.safeParse(req.query || {});

  const auth = await requireAuth(req);
  if (!auth.ok) {
    const rl = await rateLimit(req, { limit: 30, windowSec: 60 });
    res.setHeader("x-ratelimit-limit", rl.limit);
    res.setHeader("x-ratelimit-remaining", rl.remaining);
    return error(res, 401, "Unauthorized", "unauthorized", requestId);
  }

  const rl = await rateLimit(req, { limit: 120, windowSec: 60, userId: auth.user.id });
  res.setHeader("x-ratelimit-limit", rl.limit);
  res.setHeader("x-ratelimit-remaining", rl.remaining);
  if (!rl.ok) {
    return error(res, 429, "Too many requests", "rate_limited", requestId);
  }

  const admin = createSupabaseAdmin();
  const { data, error: dbError } = await admin
    .from("tenant_memberships")
    .select("id, role, status, tenant:tenants(id, slug, name)")
    .eq("user_id", auth.user.id);

  if (dbError) {
    return error(res, 500, "Membership lookup failed", "membership_lookup_failed", requestId);
  }

  return json(res, 200, {
    user: {
      id: auth.user.id,
      email: auth.user.email || null,
    },
    memberships: data || [],
  }, requestId);
}
