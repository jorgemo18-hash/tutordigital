import { ok, fail, created } from "../../lib/http.js";
import { createSupabaseAdmin } from "../../lib/supabase.js";
import { makeRequestId } from "../../lib/requestId.js";
import { rateLimit } from "../../lib/rateLimit.js";
import { sendSchoolRegistrationEmail } from "../../lib/email.js";
import { getEnv } from "../../lib/env.js";
import { z } from "zod";

const RegisterSchoolSchema = z.object({
  school_name: z.string().min(2).max(200),
  school_type: z.enum(["academia", "standalone", "integrado"]),
  slug:        z.string().min(2).max(100).regex(/^[a-z0-9-]+$/, "Slug solo puede contener letras minúsculas, números y guiones"),
  first_name:  z.string().min(1).max(100),
  last_name:   z.string().min(1).max(100),
  email:       z.string().email(),
  password:    z.string().min(8).max(128),
});

export default async function publicOnboardingRoutes(app) {

  // POST /api/v1/public/register-school
  app.post("/public/register-school", async (req, reply) => {
    const requestId = req.requestId || makeRequestId();

    const rl = await rateLimit(req, { limit: 5, windowSec: 3600, userId: req.ip || "anon", tenantId: "public" });
    reply.header("x-ratelimit-limit", rl.limit);
    reply.header("x-ratelimit-remaining", rl.remaining);
    if (!rl.ok) return fail(reply, 429, "rate_limited", "Demasiadas solicitudes. Intenta de nuevo más tarde.", requestId);

    const parsed = RegisterSchoolSchema.safeParse(req.body || {});
    if (!parsed.success) {
      return fail(reply, 400, "invalid_body", "Datos inválidos", requestId, { issues: parsed.error.issues });
    }

    const { school_name, school_type, slug, first_name, last_name, email, password } = parsed.data;
    const displayName = `${first_name} ${last_name}`.trim();

    const admin = createSupabaseAdmin();

    // Check slug is available
    const { data: existing } = await admin
      .from("tenants")
      .select("id")
      .eq("slug", slug)
      .is("deleted_at", null)
      .maybeSingle();

    if (existing) {
      return fail(reply, 409, "slug_taken", "Ese identificador ya está en uso. Elige otro.", requestId);
    }

    // Check email is not already registered
    const { data: existingUsers } = await admin.rpc("admin_find_user_by_email", { p_email: email });
    if (existingUsers?.length) {
      return fail(reply, 409, "email_taken", "Ya existe una cuenta con ese email.", requestId);
    }

    // Create tenant in pending state
    const { data: tenant, error: tenantErr } = await admin
      .from("tenants")
      .insert({ name: school_name, slug, type: school_type, status: "pending" })
      .select("id, slug, name")
      .single();

    if (tenantErr) {
      req.log.error({ err: tenantErr, requestId }, "register-school: tenant insert failed");
      return fail(reply, 500, "tenant_create_failed", "No se pudo registrar el centro. Inténtalo de nuevo.", requestId);
    }

    // Create director auth user
    const { data: authData, error: authErr } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });

    if (authErr) {
      // Rollback tenant
      await admin.from("tenants").delete().eq("id", tenant.id);
      req.log.error({ err: authErr, requestId }, "register-school: auth user create failed");
      return fail(reply, 500, "user_create_failed", "No se pudo crear el usuario. Inténtalo de nuevo.", requestId);
    }

    const userId = authData.user.id;

    // Create profile
    await admin.from("profiles").upsert({ id: userId, display_name: displayName }).eq("id", userId);

    // Create tenant_membership (admin role)
    const { error: memberErr } = await admin
      .from("tenant_memberships")
      .insert({ tenant_id: tenant.id, user_id: userId, role: "admin", status: "active" });

    if (memberErr) {
      req.log.warn({ err: memberErr, requestId }, "register-school: membership insert failed (non-blocking)");
    }

    // Send welcome email (non-blocking)
    const loginUrl = getEnv("APP_BASE_URL", "https://tutordigital.app") + "/login";
    try {
      await sendSchoolRegistrationEmail({ to: email, directorName: first_name, schoolName: school_name, loginUrl });
    } catch (emailErr) {
      req.log.warn({ err: emailErr, requestId }, "register-school: welcome email failed (non-blocking)");
    }

    req.log.info({ requestId, tenantId: tenant.id, slug, email }, "school registration submitted (pending)");

    return created(reply, {
      tenant: { id: tenant.id, slug: tenant.slug, name: tenant.name, status: "pending" },
    }, requestId);
  });
}
