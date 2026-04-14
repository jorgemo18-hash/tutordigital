import { z } from "zod";
import crypto from "node:crypto";
import { makeRequestId } from "../../lib/requestId.js";
import { ok, fail } from "../../lib/http.js";
import { rateLimit } from "../../lib/rateLimit.js";
import { requireAuth, getMembership } from "../../lib/auth.js";
import { requireRole } from "../../lib/middleware.js";
import { createSupabaseAdmin } from "../../lib/supabase.js";
import { getTenantSlug } from "../../lib/tenantSlug.js";
import { makeRouteSecurity } from "../../lib/security/routeGuards.js";
import { makeTenantMembershipGuard } from "../../lib/security/tenantMembershipGuard.js";
import { syncTeacherSubjects, syncTeacherGroups } from "../../lib/teacherUtils.js";

function hashInviteCode(code = "") {
  const pepper = process.env.INVITE_CODE_PEPPER || process.env.JOIN_CODE_PEPPER || "";
  return crypto.createHash("sha256").update(`${pepper}${String(code).trim()}`).digest("hex");
}

function normalizeEmail(value) {
  return String(value || "").trim().toLowerCase();
}

async function resolveTenantBySlug(admin, tenantSlug) {
  const { data, error } = await admin
    .from("tenants")
    .select("id, slug, name")
    .eq("slug", tenantSlug)
    .is("deleted_at", null)
    .maybeSingle();
  if (error) return { ok: false, status: 500, code: "tenant_lookup_failed" };
  if (!data) return { ok: false, status: 404, code: "tenant_not_found" };
  return { ok: true, tenant: data };
}

export default async function teacherInviteRoutes(app) {
  const redeemSecurity = makeRouteSecurity({
    env: process.env,
    allowedOriginsEnv: "CHAT_ALLOWED_ORIGINS",
    rateWindowMsEnv: "TEACHER_REDEEM_RATE_WINDOW_MS",
    rateMaxEnv: "TEACHER_REDEEM_RATE_MAX",
    routeName: "teacher-invite-redeem",
  });
  const tenantMembershipGuard = makeTenantMembershipGuard();

  app.post("/invite/redeem", { preHandler: redeemSecurity.preHandler }, async (req, reply) => {
    const requestId = req.requestId || makeRequestId();

    const auth = await requireAuth(req);
    if (!auth.ok || !auth.user?.id) {
      return fail(reply, 401, "unauthorized", "Unauthorized", requestId);
    }

    const tenantSlug = getTenantSlug(req);
    if (!tenantSlug) {
      return fail(reply, 400, "tenant_slug_required", "Tenant slug required", requestId);
    }

    const admin = createSupabaseAdmin();
    const tenantResult = await resolveTenantBySlug(admin, tenantSlug);
    if (!tenantResult.ok) {
      return fail(reply, tenantResult.status, tenantResult.code, "Tenant not found", requestId);
    }

    const rl = await rateLimit(req, {
      limit: 20,
      windowSec: 60,
      userId: auth.user.id,
      tenantId: tenantResult.tenant.id,
    });
    reply.header("x-ratelimit-limit", rl.limit);
    reply.header("x-ratelimit-remaining", rl.remaining);
    if (!rl.ok) return fail(reply, 429, "rate_limited", "Too many requests", requestId);

    const email = normalizeEmail(auth.user.email || "");
    if (!email) {
      return fail(reply, 400, "email_required", "Auth user email required", requestId);
    }

    const token = req.body?.token || req.body?.code || "";
    if (!token) {
      return fail(reply, 400, "token_required", "Invite token required", requestId);
    }

    const { data: invite, error: inviteErr } = await admin
      .from("teacher_invites")
      .select("id, email, code_hash, status, expires_at, display_name, subjects, group_ids, tutor_group_id, assignments")
      .eq("tenant_id", tenantResult.tenant.id)
      .eq("email", email)
      .eq("status", "pending")
      .order("created_at", { ascending: false })
      .maybeSingle();

    if (inviteErr) {
      req.log.error({ err: inviteErr, requestId }, "invite_lookup_failed");
      return fail(reply, 500, "invite_lookup_failed", "Failed to lookup invite", requestId);
    }

    if (!invite) {
      return fail(reply, 400, "invite_not_found", "No pending invite found", requestId);
    }

    if (invite.expires_at && new Date(invite.expires_at).getTime() <= Date.now()) {
      await admin.from("teacher_invites").update({ status: "expired" }).eq("id", invite.id);
      return fail(reply, 400, "invite_expired", "Invite expired", requestId);
    }

    const expectedHash = hashInviteCode(token);
    if (expectedHash !== invite.code_hash) {
      return fail(reply, 400, "invite_invalid", "Invalid invite token", requestId);
    }

    const { membership, error: membershipErr } = await getMembership({
      userId: auth.user.id,
      tenantId: tenantResult.tenant.id,
    });

    if (membershipErr) {
      return fail(reply, 500, "membership_lookup_failed", "Failed to check membership", requestId);
    }

    if (membership && membership.role !== "teacher" && membership.role !== "admin") {
      return fail(reply, 409, "role_conflict", "User already has a different role", requestId);
    }

    if (!membership) {
      const { error: createMembershipErr } = await admin.from("tenant_memberships").insert({
        tenant_id: tenantResult.tenant.id,
        user_id: auth.user.id,
        role: "teacher",
        status: "active",
      });
      if (createMembershipErr) {
        return fail(reply, 500, "membership_create_failed", "Failed to activate teacher membership", requestId);
      }
    } else if (membership.role === "teacher" && membership.status !== "active") {
      const { error: updateMembershipErr } = await admin
        .from("tenant_memberships")
        .update({ status: "active" })
        .eq("tenant_id", tenantResult.tenant.id)
        .eq("user_id", auth.user.id)
        .eq("role", "teacher");
      if (updateMembershipErr) {
        return fail(reply, 500, "membership_update_failed", "Failed to activate teacher membership", requestId);
      }
    }

    try {
      const { data: profile, error: profileErr } = await admin
        .from("teacher_profiles")
        .upsert(
          {
            tenant_slug: tenantResult.tenant.slug,
            email: email,
            display_name: invite.display_name || email,
            user_id: auth.user.id,
            is_active: true,
          },
          { onConflict: "tenant_slug,email" }
        )
        .select("id")
        .single();

      if (profileErr || !profile) {
        throw profileErr || new Error("profile_upsert_failed");
      }

      const teacherProfileId = profile.id;

      const assignments = Array.isArray(invite.assignments) ? invite.assignments : null;
      const rawSubjects = assignments
        ? assignments.map(a => String(a.subject || "").trim()).filter(Boolean)
        : (invite.subjects || []);
      const rawGroupIds = assignments
        ? [...new Set(assignments.flatMap(a => a.group_ids || []).filter(Boolean))]
        : (invite.group_ids || []);

      await syncTeacherSubjects(admin, teacherProfileId, tenantResult.tenant.slug, rawSubjects);
      await syncTeacherGroups(
        admin, teacherProfileId, rawGroupIds, invite.tutor_group_id || null,
        assignments ? { assignments, tenantSlug: tenantResult.tenant.slug } : {}
      );
    } catch (syncError) {
      req.log.error({ err: syncError, requestId }, "teacher_profile_sync_failed");
      return fail(
        reply,
        500,
        "profile_sync_failed", "Failed to create or sync teacher profile", requestId
      );
    }
    await admin
      .from("teacher_invites")
      .update({ status: "used", used_at: new Date().toISOString() })
      .eq("id", invite.id);

    return ok(
      reply,
      {
        status: "active",
        tenant: tenantResult.tenant,
        role: "teacher",
        route: "/assets/teacher/",
      },
      requestId
    );
  });

  app.get("/me", { preHandler: tenantMembershipGuard.preHandler }, async (req, reply) => {
    const requestId = req.requestId || makeRequestId();
    const tenantSlug = getTenantSlug(req);

    const auth = await requireRole(req, reply, requestId, {
      tenantSlug,
      roles: ["teacher", "admin"],
    });
    if (!auth.ok) return;

    const admin = createSupabaseAdmin();
    const email = normalizeEmail(auth.user.email || "");

    let profile = null;
    const { data: byUser } = await admin
      .from("teacher_profiles")
      .select("id, email, display_name, user_id")
      .eq("tenant_slug", auth.tenant.slug)
      .eq("user_id", auth.user.id)
      .maybeSingle();
    profile = byUser || null;

    if (!profile && email) {
      const { data: byEmail } = await admin
        .from("teacher_profiles")
        .select("id, email, display_name, user_id")
        .eq("tenant_slug", auth.tenant.slug)
        .eq("email", email)
        .maybeSingle();
      profile = byEmail || null;
      if (profile?.id && !profile?.user_id) {
        await admin.from("teacher_profiles").update({ user_id: auth.user.id }).eq("id", profile.id);
        profile.user_id = auth.user.id;
      }
    }

    if (!profile) {
      return fail(reply, 404, "teacher_profile_not_found", "Teacher profile not found", requestId);
    }

    const [{ data: subjectRows }, { data: groupRows }] = await Promise.all([
      admin
        .from("teacher_subjects")
        .select("subject:subjects(id, name)")
        .eq("teacher_profile_id", profile.id),
      admin
        .from("teacher_groups")
        .select("is_tutor, group:groups(id, name, level)")
        .eq("teacher_profile_id", profile.id),
    ]);

    const groups = (groupRows || [])
      .map((row) => ({
        id: row.group?.id,
        name: row.group?.name || "",
        level: row.group?.level || null,
        is_tutor: Boolean(row.is_tutor),
      }))
      .filter((row) => row.id);

    const tutorGroups = groups.filter((g) => g.is_tutor).map((g) => g.id);

    return ok(
      reply,
      {
        teacher: {
          id: profile.id,
          email: profile.email,
          display_name: profile.display_name,
          subjects: (subjectRows || [])
            .map((row) => row.subject?.name)
            .filter(Boolean),
          groups,
          tutor_groups: tutorGroups,
        },
      },
      requestId
    );
  });
}
