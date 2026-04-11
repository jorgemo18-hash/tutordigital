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
import { autoRedeemInvites } from "../../lib/teacherUtils.js";

const LoginBodySchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

const SignupBodySchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
});

const SetInvitePasswordBodySchema = z.object({
  password: z.string().min(6),
});

const ChangePasswordBodySchema = z.object({
  password: z.string().min(8, "La contraseña debe tener al menos 8 caracteres"),
});

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
    const authEmail = String(data.user.email || "").trim().toLowerCase();
    await autoRedeemInvites(admin, data.user.id, authEmail);

    const { data: memberships, error: membershipError } = await admin
      .from("tenant_memberships")
      .select("id, role, status, tenant:tenants(id, slug, name)")
      .eq("user_id", data.user.id);
    if (membershipError) {
      return fail(reply, 500, "membership_lookup_failed", "Membership lookup failed", requestId);
    }

    const { data: profile } = await admin
      .from("profiles")
      .select("must_change_password")
      .eq("id", data.user.id)
      .maybeSingle();

    return ok(
      reply,
      {
        access_token: data.session.access_token,
        refresh_token: data.session.refresh_token,
        expires_at: data.session.expires_at,
        token_type: data.session.token_type,
        user: {
          id: data.user.id,
          email: data.user.email || null,
          must_change_password: profile?.must_change_password === true,
        },
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
    // No llamar a autoRedeemInvites en signup: el flujo de invitación usa
    // invite.html que llama explícitamente a /invite/redeem con verificación
    // de token. Llamarlo aquí marca el invite como "used" antes de que el
    // redeem explícito pueda ejecutarse, causando "No pending invite found".

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

  // POST /set-invite-password
  // Establece la contraseña de un usuario que llegó via invitación de Supabase.
  // Requiere el access_token de la invitación en el header Authorization.
  app.route({
    method: allMethods,
    url: "/set-invite-password",
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

      const token = getBearerToken(req);
      if (!token) {
        return fail(reply, 401, "unauthorized", "Se requiere el token de invitación.", requestId);
      }

      const parsed = SetInvitePasswordBodySchema.safeParse(req.body || {});
      if (!parsed.success) {
        return fail(reply, 400, "invalid_body", "La contraseña debe tener al menos 6 caracteres.", requestId);
      }

      const { password } = parsed.data;

      // Validar el token para obtener el usuario (auth.updateUser requiere sesión
      // interna; usamos admin.updateUserById para evitar AuthSessionMissingError).
      const anonClient = createSupabaseUserClient();
      const { data: userData, error: getUserError } = await anonClient.auth.getUser(token);
      if (getUserError || !userData?.user) {
        req.log.error({ err: getUserError, requestId }, "set_invite_password_invalid_token");
        return fail(reply, 401, "unauthorized", "Token de invitación inválido o expirado.", requestId);
      }

      const admin = createSupabaseAdmin();
      const { data, error } = await admin.auth.admin.updateUserById(userData.user.id, { password });

      if (error || !data?.user) {
        req.log.error({ err: error, requestId }, "set_invite_password_failed");
        return fail(reply, 400, "update_password_failed", error?.message || "No se pudo establecer la contraseña.", requestId);
      }

      return ok(
        reply,
        { user: { id: data.user.id, email: data.user.email || null } },
        requestId
      );
    },
  });

  // POST /change-password
  // Cambia la contraseña del usuario autenticado y desactiva must_change_password.
  app.route({
    method: allMethods,
    url: "/change-password",
    handler: async (req, reply) => {
      const requestId = req.requestId || makeRequestId();
      if (req.method !== "POST") {
        return fail(reply, 405, "method_not_allowed", "Method not allowed", requestId);
      }

      const auth = await requireAuth(req);
      if (!auth.ok) {
        return fail(reply, 401, "unauthorized", "Unauthorized", requestId);
      }

      const rl = await rateLimit(req, { limit: 10, windowSec: 60, userId: auth.user.id });
      reply.header("x-ratelimit-limit", rl.limit);
      reply.header("x-ratelimit-remaining", rl.remaining);
      if (!rl.ok) {
        return fail(reply, 429, "rate_limited", "Too many requests", requestId);
      }

      const parsed = ChangePasswordBodySchema.safeParse(req.body || {});
      if (!parsed.success) {
        return fail(reply, 400, "invalid_body", parsed.error.issues[0]?.message || "La contraseña debe tener al menos 8 caracteres.", requestId);
      }

      const { password } = parsed.data;
      const admin = createSupabaseAdmin();

      const { error: updateErr } = await admin.auth.admin.updateUserById(auth.user.id, { password });
      if (updateErr) {
        req.log.error({ err: updateErr, requestId }, "change_password_failed");
        return fail(reply, 500, "change_password_failed", updateErr.message || "No se pudo actualizar la contraseña.", requestId);
      }

      const { error: profErr } = await admin
        .from("profiles")
        .update({ must_change_password: false })
        .eq("id", auth.user.id);
      if (profErr) {
        req.log.error({ err: profErr, requestId }, "change_password_profile_update_failed");
      }

      return ok(reply, { ok: true }, requestId);
    },
  });

  // POST /exchange-invite-code
  // Intercambia un código PKCE de invitación de Supabase por tokens de sesión.
  // Supabase redirige con ?code= en flujo PKCE; este endpoint lo canjea server-side.
  app.route({
    method: allMethods,
    url: "/exchange-invite-code",
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

      const parsed = z.object({ code: z.string().min(1) }).safeParse(req.body || {});
      if (!parsed.success) {
        return fail(reply, 400, "invalid_body", "Se requiere el código de intercambio.", requestId);
      }

      const { code } = parsed.data;
      const client = createSupabaseUserClient();
      const { data, error } = await client.auth.exchangeCodeForSession(code);

      if (error || !data?.session) {
        req.log.error({ err: error, requestId }, "exchange_invite_code_failed");
        return fail(reply, 400, "exchange_failed", error?.message || "No se pudo intercambiar el código.", requestId);
      }

      return ok(reply, {
        access_token: data.session.access_token,
        refresh_token: data.session.refresh_token,
        expires_at: data.session.expires_at,
      }, requestId);
    },
  });
}
