import { z } from "zod";
import { makeRequestId } from "../../lib/requestId.js";
import { ok, fail } from "../../lib/http.js";
import { rateLimit } from "../../lib/rateLimit.js";
import { requireAuth } from "../../lib/auth.js";
import {
  createSupabaseAdmin,
  createSupabaseUserClient,
  getBearerToken,
} from "../../lib/supabase.js";

const LoginBodySchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

const SignupBodySchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
});

export default async function authRoutes(app) {
  const allMethods = ["GET", "POST", "PATCH", "PUT", "DELETE", "OPTIONS"];

  app.route({
    method: allMethods,
    url: "/login",
    handler: async (req, reply) => {
    const requestId = makeRequestId();
    if (req.method !== "POST") {
      return fail(reply, 405, "method_not_allowed", "Method not allowed", requestId);
    }

    const rl = await rateLimit(req, { limit: 10, windowSec: 60 });
    reply.header("x-ratelimit-limit", rl.limit);
    reply.header("x-ratelimit-remaining", rl.remaining);
    if (!rl.ok) {
      return fail(reply, 429, "rate_limited", "Too many requests", requestId);
    }

    const parsed = LoginBodySchema.safeParse(req.body || {});
    if (!parsed.success) {
      return fail(reply, 400, "invalid_body", "Invalid body", requestId, {
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
      const msg = authError?.message || "Invalid credentials";
      const lowered = msg.toLowerCase();
      const code = lowered.includes("confirm") ? "email_not_confirmed" : "unauthorized";
      return fail(reply, 401, code, msg, requestId);
    }

    const admin = createSupabaseAdmin();
    const { data: memberships, error: membershipError } = await admin
      .from("tenant_memberships")
      .select("id, role, status, tenant:tenants(id, slug, name)")
      .eq("user_id", data.user.id);
    if (membershipError) {
      return fail(reply, 500, "membership_lookup_failed", "Membership lookup failed", requestId);
    }

    return ok(
      reply,
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
    },
  });

  app.route({
    method: allMethods,
    url: "/logout",
    handler: async (req, reply) => {
    const requestId = makeRequestId();
    if (req.method !== "POST") {
      return fail(reply, 405, "method_not_allowed", "Method not allowed", requestId);
    }

    const auth = await requireAuth(req);
    if (!auth.ok) {
      const rl = await rateLimit(req, { limit: 30, windowSec: 60 });
      reply.header("x-ratelimit-limit", rl.limit);
      reply.header("x-ratelimit-remaining", rl.remaining);
      return fail(reply, 401, "unauthorized", "Unauthorized", requestId);
    }

    const rl = await rateLimit(req, { limit: 60, windowSec: 60, userId: auth.user.id });
    reply.header("x-ratelimit-limit", rl.limit);
    reply.header("x-ratelimit-remaining", rl.remaining);
    if (!rl.ok) {
      return fail(reply, 429, "rate_limited", "Too many requests", requestId);
    }

    const token = getBearerToken(req);
    const client = createSupabaseUserClient(token);
    const { error: signOutError } = await client.auth.signOut();
    if (signOutError) {
      return fail(reply, 500, "logout_failed", "Logout failed", requestId);
    }

    return ok(reply, { ok: true }, requestId);
    },
  });

  app.route({
    method: allMethods,
    url: "/signup",
    handler: async (req, reply) => {
    const requestId = makeRequestId();
    if (req.method !== "POST") {
      return fail(reply, 405, "method_not_allowed", "Method not allowed", requestId);
    }

    const rl = await rateLimit(req, { limit: 10, windowSec: 60 });
    reply.header("x-ratelimit-limit", rl.limit);
    reply.header("x-ratelimit-remaining", rl.remaining);
    if (!rl.ok) {
      return fail(reply, 429, "rate_limited", "Too many requests", requestId);
    }

    const parsed = SignupBodySchema.safeParse(req.body || {});
    if (!parsed.success) {
      return fail(reply, 400, "invalid_body", "Invalid body", requestId, {
        issues: parsed.error.issues,
      });
    }

    const { email, password } = parsed.data;
    const client = createSupabaseUserClient();
    const { data, error: authError } = await client.auth.signUp({
      email,
      password,
    });

    if (authError) {
      return fail(reply, 400, "signup_failed", authError.message || "Signup failed", requestId);
    }

    const session = data?.session || null;
    if (!session) {
      return ok(
        reply,
        {
          user: { id: data?.user?.id || null, email: data?.user?.email || email },
          needs_email_confirm: true,
          memberships: [],
        },
        requestId
      );
    }

    const admin = createSupabaseAdmin();
    const { data: memberships, error: membershipError } = await admin
      .from("tenant_memberships")
      .select("id, role, status, tenant:tenants(id, slug, name)")
      .eq("user_id", data.user.id);
    if (membershipError) {
      return fail(reply, 500, "membership_lookup_failed", "Membership lookup failed", requestId);
    }

    return ok(
      reply,
      {
        access_token: session.access_token,
        refresh_token: session.refresh_token,
        expires_at: session.expires_at,
        token_type: session.token_type,
        user: { id: data.user.id, email: data.user.email || null },
        memberships: memberships || [],
      },
      requestId
    );
    },
  });
}
