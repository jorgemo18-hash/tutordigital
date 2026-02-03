import { z } from "zod";
import { makeRequestId } from "../_lib/requestId.js";
import { ok, fail } from "../_lib/http.js";
import { rateLimit } from "../_lib/rateLimit.js";
import { createSupabaseAdmin, createSupabaseUserClient } from "../_lib/supabase.js";

const BodySchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
});

export default async function handler(req, res) {
  const requestId = makeRequestId();
  if (req.method !== "POST") {
    return fail(res, 405, "method_not_allowed", "Method not allowed", requestId);
  }

  const rl = await rateLimit(req, { limit: 10, windowSec: 60 });
  res.setHeader("x-ratelimit-limit", rl.limit);
  res.setHeader("x-ratelimit-remaining", rl.remaining);
  if (!rl.ok) {
    return fail(res, 429, "rate_limited", "Too many requests", requestId);
  }

  const parsed = BodySchema.safeParse(req.body || {});
  if (!parsed.success) {
    return fail(res, 400, "invalid_body", "Invalid body", requestId, {
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
    return fail(res, 401, "unauthorized", "Invalid credentials", requestId);
  }

  const admin = createSupabaseAdmin();
  const { data: memberships, error: membershipError } = await admin
    .from("tenant_memberships")
    .select("id, role, status, tenant:tenants(id, slug, name)")
    .eq("user_id", data.user.id);
  if (membershipError) {
    return fail(res, 500, "membership_lookup_failed", "Membership lookup failed", requestId);
  }

  return ok(
    res,
    {
      access_token: data.session.access_token,
      refresh_token: data.session.refresh_token,
      expires_at: data.session.expires_at,
      token_type: data.session.token_type,
      user: { id: data.user.id, email: data.user.email || null },
      memberships: memberships || [],
    },
    requestId
  );
}
