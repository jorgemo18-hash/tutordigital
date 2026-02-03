import { z } from "zod";
import { makeRequestId } from "../_lib/requestId.js";
import { error, json } from "../_lib/response.js";
import { rateLimit } from "../_lib/rateLimit.js";
import { createSupabaseUserClient } from "../_lib/supabase.js";

const BodySchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
});

export default async function handler(req, res) {
  const requestId = makeRequestId();
  if (req.method !== "POST") {
    return error(res, 405, "Method not allowed", "method_not_allowed", requestId);
  }

  const rl = await rateLimit(req, { limit: 10, windowSec: 60 });
  res.setHeader("x-ratelimit-limit", rl.limit);
  res.setHeader("x-ratelimit-remaining", rl.remaining);
  if (!rl.ok) {
    return error(res, 429, "Too many requests", "rate_limited", requestId);
  }

  const parsed = BodySchema.safeParse(req.body || {});
  if (!parsed.success) {
    return error(res, 400, "Invalid body", "invalid_body", requestId, {
      issues: parsed.error.issues,
    });
  }

  const { email, password } = parsed.data;
  const client = createSupabaseUserClient();
  const { data, error: authError } = await client.auth.signInWithPassword({
    email,
    password,
  });

  if (authError || !data?.session) {
    return error(res, 401, "Invalid credentials", "invalid_credentials", requestId);
  }

  return json(res, 200, {
    user: data.user,
    session: {
      access_token: data.session.access_token,
      refresh_token: data.session.refresh_token,
      expires_at: data.session.expires_at,
      token_type: data.session.token_type,
    },
  }, requestId);
}
