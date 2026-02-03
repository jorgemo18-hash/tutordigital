import { makeRequestId } from "../_lib/requestId.js";
import { error, json } from "../_lib/response.js";
import { requireAuth } from "../_lib/auth.js";
import { rateLimit } from "../_lib/rateLimit.js";
import { createSupabaseUserClient, getBearerToken } from "../_lib/supabase.js";

export default async function handler(req, res) {
  const requestId = makeRequestId();
  if (req.method !== "POST") {
    return error(res, 405, "Method not allowed", "method_not_allowed", requestId);
  }

  const auth = await requireAuth(req);
  if (!auth.ok) {
    const rl = await rateLimit(req, { limit: 30, windowSec: 60 });
    res.setHeader("x-ratelimit-limit", rl.limit);
    res.setHeader("x-ratelimit-remaining", rl.remaining);
    return error(res, 401, "Unauthorized", "unauthorized", requestId);
  }

  const rl = await rateLimit(req, { limit: 60, windowSec: 60, userId: auth.user.id });
  res.setHeader("x-ratelimit-limit", rl.limit);
  res.setHeader("x-ratelimit-remaining", rl.remaining);
  if (!rl.ok) {
    return error(res, 429, "Too many requests", "rate_limited", requestId);
  }

  const token = getBearerToken(req);
  const client = createSupabaseUserClient(token);
  const { error: signOutError } = await client.auth.signOut();
  if (signOutError) {
    return error(res, 500, "Logout failed", "logout_failed", requestId);
  }

  return json(res, 200, { ok: true }, requestId);
}
