import { z } from "zod";
import crypto from "node:crypto";
import { makeRequestId } from "../../lib/requestId.js";
import { ok, fail } from "../../lib/http.js";
import { rateLimit } from "../../lib/rateLimit.js";
import { createSupabaseAdmin } from "../../lib/supabase.js";
import { makeRouteSecurity } from "../../lib/security/routeGuards.js";

const RegisterSchema = z.object({
  group_code:   z.string().min(4).max(32),
  email:        z.string().email(),
  password:     z.string().min(6).max(128),
  display_name: z.string().trim().min(1).max(120),
});

function normalizeEmail(value) {
  return String(value || "").trim().toLowerCase();
}

function hashJoinCode(code = "") {
  const pepper = process.env.JOIN_CODE_PEPPER || process.env.INVITE_CODE_PEPPER || "";
  return crypto.createHash("sha256").update(`${pepper}${String(code).trim()}`).digest("hex");
}

export default async function studentRegisterRoutes(app) {
  const security = makeRouteSecurity({
    env: process.env,
    allowedOriginsEnv: "CHAT_ALLOWED_ORIGINS",
    rateWindowMsEnv: "STUDENT_REGISTER_RATE_WINDOW_MS",
    rateMaxEnv: "STUDENT_REGISTER_RATE_MAX",
    routeName: "student-register",
  });

  // POST /api/v1/student/register — público, no requiere auth previa
  app.post("/student/register", { preHandler: security.preHandler }, async (req, reply) => {
    const requestId = req.requestId || makeRequestId();

    const parsed = RegisterSchema.safeParse(req.body || {});
    if (!parsed.success) {
      return fail(reply, 400, "invalid_body", "Datos inválidos", requestId, { issues: parsed.error.issues });
    }

    // Rate limit por IP (sin userId todavía)
    const rl = await rateLimit(req, { limit: 10, windowSec: 60 });
    reply.header("x-ratelimit-limit", rl.limit);
    reply.header("x-ratelimit-remaining", rl.remaining);
    if (!rl.ok) return fail(reply, 429, "rate_limited", "Demasiados intentos. Espera un minuto.", requestId);

    const { group_code, password, display_name } = parsed.data;
    const email = normalizeEmail(parsed.data.email);
    const codeHash = hashJoinCode(group_code.trim().toUpperCase());

    const admin = createSupabaseAdmin();

    // 1. Resolver el grupo por su código
    const { data: group, error: groupErr } = await admin
      .from("groups")
      .select("id, name, tenant_id")
      .eq("join_code_hash", codeHash)
      .maybeSingle();

    if (groupErr) {
      req.log.error({ err: groupErr, requestId }, "student register: group lookup failed");
      return fail(reply, 500, "group_lookup_failed", "Error al verificar el código", requestId);
    }
    if (!group) {
      return fail(reply, 400, "invalid_group_code", "Código de grupo no válido", requestId);
    }

    // 2. Resolver el tenant
    const { data: tenant, error: tenantErr } = await admin
      .from("tenants")
      .select("id, slug, name")
      .eq("id", group.tenant_id)
      .maybeSingle();

    if (tenantErr || !tenant) {
      return fail(reply, 500, "tenant_lookup_failed", "Error al verificar el centro", requestId);
    }

    // 3. Verificar que el email está autorizado para este grupo
    const { data: invite, error: inviteErr } = await admin
      .from("student_invites")
      .select("id, status")
      .eq("group_id", group.id)
      .eq("email", email)
      .in("status", ["pending", "used"])  // buscar cualquiera para dar mensaje preciso
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (inviteErr) {
      req.log.error({ err: inviteErr, requestId }, "student register: invite lookup failed");
      return fail(reply, 500, "invite_lookup_failed", "Error al verificar autorización", requestId);
    }
    if (!invite) {
      return fail(
        reply, 403, "email_not_authorized",
        "Tu email no está autorizado para este grupo. Pide a tu profesor que te añada.",
        requestId
      );
    }
    if (invite.status === "used") {
      return fail(
        reply, 409, "user_already_exists",
        "Ya tienes una cuenta creada. Inicia sesión directamente en la app.",
        requestId
      );
    }

    // 4. Crear usuario en Supabase Auth (sin enviar email de confirmación)
    let authUser = null;
    const { data: newUser, error: createUserErr } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,  // confirmar directamente, no magic link
      user_metadata: { display_name },
    });

    if (createUserErr) {
      // Supabase devuelve code:"email_exists" (422) o mensaje "already registered"
      const isAlreadyExists =
        createUserErr.code === "email_exists" ||
        createUserErr.status === 422 ||
        String(createUserErr.message || "").toLowerCase().includes("already registered");
      if (isAlreadyExists) {
        return fail(
          reply, 409, "user_already_exists",
          "Ya existe una cuenta con este email. Inicia sesión en /invite.html o usa la app.",
          requestId
        );
      }
      req.log.error({ err: createUserErr, requestId }, "student register: create user failed");
      return fail(reply, 500, "user_create_failed", "No se pudo crear la cuenta", requestId);
    }
    authUser = newUser.user;

    // 5. Crear membership como student (activo directamente)
    const { error: memberErr } = await admin.from("tenant_memberships").insert({
      tenant_id: tenant.id,
      user_id: authUser.id,
      role: "student",
      status: "active",
    });

    if (memberErr && memberErr.code !== "23505") {
      req.log.error({ err: memberErr, requestId }, "student register: membership create failed");
      return fail(reply, 500, "membership_create_failed", "Error al activar acceso", requestId);
    }

    // 6. Crear registro de alumno vinculado al grupo
    const { error: studentErr } = await admin.from("students").insert({
      tenant_id: tenant.id,
      user_id: authUser.id,
      group_id: group.id,
      display_name: display_name.trim(),
      status: "pending",
      approval_status: "approved",  // acceso por lista blanca = aprobado automáticamente
    });

    // 23505 = unique_violation: el alumno ya existe, no es un error real
    if (studentErr && studentErr.code !== "23505") {
      req.log.error({ err: studentErr, requestId }, "student register: student record failed");
      return fail(reply, 500, "student_create_failed", "Error al crear perfil de alumno", requestId);
    }

    // 7. Marcar invite como usado
    await admin
      .from("student_invites")
      .update({ status: "used" })
      .eq("id", invite.id);

    // 8. Generar sesión para el alumno (login inmediato con las credenciales recién creadas)
    const { createClient } = await import("@supabase/supabase-js");
    const anonClient = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);
    const { data: signInData } = await anonClient.auth.signInWithPassword({ email, password });
    const tokens = signInData?.session
      ? {
          access_token:  signInData.session.access_token,
          refresh_token: signInData.session.refresh_token,
          expires_at:    signInData.session.expires_at,
        }
      : null;

    return ok(
      reply,
      {
        status: "registered",
        tenant: { id: tenant.id, slug: tenant.slug, name: tenant.name },
        group:  { id: group.id, name: group.name },
        route:  "/assets/student/",
        session: tokens,
      },
      requestId
    );
  });
}
