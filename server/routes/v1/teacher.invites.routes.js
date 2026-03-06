import crypto from "node:crypto";
import { z } from "zod";
import { makeRequestId } from "../../lib/requestId.js";
import { ok, fail } from "../../lib/http.js";
import { rateLimit } from "../../lib/rateLimit.js";
import { requireAuth, getMembership } from "../../lib/auth.js";
import { requireRole } from "../../lib/middleware.js";
import { createSupabaseAdmin } from "../../lib/supabase.js";
import { getTenantSlug } from "../../lib/tenantSlug.js";
import { makeRouteSecurity } from "../../lib/security/routeGuards.js";
import { makeTenantMembershipGuard } from "../../lib/security/tenantMembershipGuard.js";

const RedeemSchema = z.object({
  code: z.string().min(4).max(64),
});

// TODO: Refactor these helpers into a shared module (e.g., /lib/teacherUtils.js)
// Copied from admin.teachers.routes.js for now.
function normalizeSubject(value) {
  const raw = String(value || "").trim().replace(/\s+/g, " ");
  return {
    name: raw,
    norm: raw.toLowerCase(),
  };
}

function uniq(values = []) {
  return Array.from(new Set(values));
}

async function syncTeacherSubjects(admin, teacherProfileId, tenantSlug, subjectsRaw = []) {
  const normalized = uniq(subjectsRaw.map(normalizeSubject).filter((x) => x.name).map((x) => `${x.norm}::${x.name}`))
    .map((value) => {
      const [norm, ...rest] = value.split("::");
      return { norm, name: rest.join("::") };
    });

  if (!normalized.length) {
    await admin.from("teacher_subjects").delete().eq("teacher_profile_id", teacherProfileId);
    return [];
  }

  const { error: upsertErr } = await admin.from("subjects").upsert(
    normalized.map((item) => ({
      tenant_slug: tenantSlug,
      name: item.name,
      name_norm: item.norm,
    })),
    { onConflict: "tenant_slug,name_norm" }
  );
  if (upsertErr) throw new Error("subjects_upsert_failed");

  const norms = normalized.map((item) => item.norm);
  const { data: subjectRows, error: subjectsErr } = await admin
    .from("subjects")
    .select("id, name")
    .eq("tenant_slug", tenantSlug)
    .in("name_norm", norms);

  if (subjectsErr) throw new Error("subjects_lookup_failed");

  const subjectIds = (subjectRows || []).map((row) => row.id);
  await admin.from("teacher_subjects").delete().eq("teacher_profile_id", teacherProfileId);

  if (subjectIds.length) {
    const { error: linkErr } = await admin.from("teacher_subjects").insert(
      subjectIds.map((subjectId) => ({
        teacher_profile_id: teacherProfileId,
        subject_id: subjectId,
      }))
    );
    if (linkErr) throw new Error("teacher_subjects_sync_failed");
  }

  return subjectRows || [];
}

async function syncTeacherGroups(admin, teacherProfileId, groupIds = [], tutorGroupId = null) {
  await admin.from("teacher_groups").delete().eq("teacher_profile_id", teacherProfileId);
  const uniqueGroupIds = uniq(groupIds.filter(Boolean));
  if (!uniqueGroupIds.length) return [];
  const rows = uniqueGroupIds.map((groupId) => ({
    teacher_profile_id: teacherProfileId,
    group_id: groupId,
    is_tutor: tutorGroupId ? tutorGroupId === groupId : false,
  }));
  const { error } = await admin.from("teacher_groups").insert(rows);
  if (error) throw new Error("teacher_groups_sync_failed");
  return rows;
}

function normalizeEmail(value) {
  return String(value || "").trim().toLowerCase();
}

function hashInviteCode(code = "") {
  const pepper = process.env.INVITE_CODE_PEPPER || process.env.JOIN_CODE_PEPPER || "";
  return crypto.createHash("sha256").update(`${pepper}${String(code).trim()}`).digest("hex");
}

async function resolveTenantBySlug(admin, tenantSlug) {
  const { data, error } = await admin
    .from("tenants")
    .select("id, slug, name")
    .eq("slug", tenantSlug)
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

    const parsed = RedeemSchema.safeParse(req.body || {});
    if (!parsed.success) {
      return fail(reply, 400, "invalid_body", "Invalid body", requestId, {
        issues: parsed.error.issues,
      });
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

    const { data: invite } = await admin
      .from("teacher_invites")
      .select("id, email, code_hash, status, expires_at, display_name, subjects, group_ids, tutor_group_id")
      .eq("tenant_slug", tenantResult.tenant.slug)
      .eq("email", email)
      .eq("status", "pending")
      .order("created_at", { ascending: false })
      .maybeSingle();

    if (!invite) {
      return fail(reply, 400, "invite_not_found", "No pending invite found", requestId);
    }

    if (invite.expires_at && new Date(invite.expires_at).getTime() <= Date.now()) {
      await admin.from("teacher_invites").update({ status: "expired" }).eq("id", invite.id);
      return fail(reply, 400, "invite_expired", "Invite expired", requestId);
    }

    const expectedHash = hashInviteCode(parsed.data.code);
    if (expectedHash !== invite.code_hash) {
      return fail(reply, 400, "invite_invalid", "Invalid invite code", requestId);
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
            display_name: invite.display_name,
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

      await syncTeacherSubjects(admin, teacherProfileId, tenantResult.tenant.slug, invite.subjects || []);
      await syncTeacherGroups(admin, teacherProfileId, invite.group_ids || [], invite.tutor_group_id || null);
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
