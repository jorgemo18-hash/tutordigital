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
import { syncTeacherSubjects, syncTeacherGroups } from "../../lib/teacherUtils.js";

const LoginBodySchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

const SignupBodySchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
});

async function autoRedeemInvites(admin, userId, email) {
  if (!email) return;
  const safeEmail = String(email).trim().toLowerCase();

  // Buscar invitaciones pendientes para este email
  const { data: invites } = await admin
    .from("teacher_invites")
    .select("id, tenant_id, tenant_slug, display_name, subjects, group_ids, tutor_group_id")
    .eq("email", safeEmail)
    .eq("status", "pending");

  if (!invites || !invites.length) return;

  for (const invite of invites) {
    // 1. Crear/Activar membership
    const { error: memberErr } = await admin.from("tenant_memberships").upsert(
      {
        tenant_id: invite.tenant_id,
        user_id: userId,
        role: "teacher",
        status: "active",
      },
      { onConflict: "tenant_id,user_id" }
    );

    if (memberErr) {
      console.error("[AUTO_REDEEM] Failed membership", memberErr);
      continue;
    }

    // 2. Crear/Actualizar perfil de profesor
    const { data: profile, error: profileErr } = await admin
      .from("teacher_profiles")
      .upsert(
        {
          tenant_slug: invite.tenant_slug,
          email: safeEmail,
          display_name: invite.display_name,
          user_id: userId,
          is_active: true,
        },
        { onConflict: "tenant_slug,email" }
      )
      .select("id")
      .single();

    if (profileErr || !profile) {
      console.error("[AUTO_REDEEM] Failed profile", profileErr);
      continue;
    }

    // 3. Sincronizar datos
    await syncTeacherSubjects(admin, profile.id, invite.tenant_slug, invite.subjects || []);
    await syncTeacherGroups(admin, profile.id, invite.group_ids || [], invite.tutor_group_id || null);

    // 4. Marcar invitación como usada
    await admin.from("teacher_invites").update({ status: "used", used_at: new Date().toISOString() }).eq("id", invite.id);
  }
}

export default async function authRoutes(app) {
  const allMethods = ["GET", "POST", "PATCH", "PUT", "DELETE", "OPTIONS"];

  app.route({
    method: allMethods,
    url: "/login",
    handler: async (req, reply) => {
    const requestId = req.requestId || makeRequestId();
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
    // Auto-canje de invitaciones pendientes al hacer login
    await autoRedeemInvites(admin, data.user.id, data.user.email);

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
    const requestId = req.requestId || makeRequestId();
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
    const requestId = req.requestId || makeRequestId();
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
    // Auto-canje de invitaciones pendientes al registrarse (si no requiere confirmación o ya está confirmado)
    if (session) await autoRedeemInvites(admin, data.user.id, data.user.email);

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
