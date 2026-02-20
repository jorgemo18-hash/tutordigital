import crypto from "node:crypto";
import { z } from "zod";
import { makeRequestId } from "../../lib/requestId.js";
import { ok, created, fail } from "../../lib/http.js";
import { rateLimit } from "../../lib/rateLimit.js";
import { requireRole } from "../../lib/middleware.js";
import { getTenantSlug } from "../../lib/tenantSlug.js";
import { createSupabaseAdmin } from "../../lib/supabase.js";
import { makeRouteSecurity } from "../../lib/security/routeGuards.js";
import { makeTenantMembershipGuard } from "../../lib/security/tenantMembershipGuard.js";

const InviteSchema = z.object({
  email: z.string().email(),
  display_name: z.string().min(1).max(120),
  subjects: z.array(z.string().min(1).max(80)).default([]),
  group_ids: z.array(z.string().uuid()).default([]),
  tutor_group_id: z.string().uuid().optional().nullable(),
});

const RevokeParamsSchema = z.object({
  id: z.string().uuid(),
});

function normalizeEmail(value) {
  return String(value || "").trim().toLowerCase();
}

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


function randomInviteCode() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const pick = () => chars[Math.floor(Math.random() * chars.length)];
  let out = "";
  for (let i = 0; i < 8; i += 1) {
    out += pick();
    if (i === 3) out += "-";
  }
  return out;
}

function hashInviteCode(code = "") {
  const pepper = process.env.INVITE_CODE_PEPPER || process.env.JOIN_CODE_PEPPER || "";
  return crypto.createHash("sha256").update(`${pepper}${String(code).trim()}`).digest("hex");
}

async function ensureGroupsBelongToTenant(admin, tenantId, groupIds) {
  if (!groupIds.length) return { ok: true, groups: [] };
  const { data, error } = await admin
    .from("groups")
    .select("id")
    .eq("tenant_id", tenantId)
    .in("id", groupIds);

  if (error) return { ok: false, reason: "groups_lookup_failed" };
  const found = new Set((data || []).map((row) => row.id));
  const missing = groupIds.filter((id) => !found.has(id));
  if (missing.length) return { ok: false, reason: "invalid_group_ids", missing };
  return { ok: true, groups: data || [] };
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

function mapTeachers(profiles = [], subjects = [], groups = [], invites = []) {
  const subjectsByProfile = new Map();
  const groupsByProfile = new Map();
  const inviteByEmail = new Map();

  subjects.forEach((row) => {
    const teacherProfileId = row.teacher_profile_id;
    const list = subjectsByProfile.get(teacherProfileId) || [];
    if (row.subject?.name) list.push(row.subject.name);
    subjectsByProfile.set(teacherProfileId, list);
  });

  groups.forEach((row) => {
    const teacherProfileId = row.teacher_profile_id;
    const list = groupsByProfile.get(teacherProfileId) || [];
    if (row.group?.id) {
      list.push({
        id: row.group.id,
        name: row.group.name || "",
        level: row.group.level || null,
        is_tutor: Boolean(row.is_tutor),
      });
    }
    groupsByProfile.set(teacherProfileId, list);
  });

  invites.forEach((row) => {
    const email = normalizeEmail(row.email);
    const prev = inviteByEmail.get(email);
    if (!prev) {
      inviteByEmail.set(email, row);
      return;
    }
    if (String(row.created_at || "") > String(prev.created_at || "")) {
      inviteByEmail.set(email, row);
    }
  });

  return profiles.map((profile) => {
    const email = normalizeEmail(profile.email);
    const invite = inviteByEmail.get(email) || null;
    return {
      id: profile.id,
      email: profile.email,
      display_name: profile.display_name,
      is_active: Boolean(profile.is_active),
      user_id: profile.user_id || null,
      subjects: subjectsByProfile.get(profile.id) || [],
      groups: groupsByProfile.get(profile.id) || [],
      invite: invite
        ? {
            id: invite.id,
            status: invite.status,
            created_at: invite.created_at,
            used_at: invite.used_at,
            expires_at: invite.expires_at,
          }
        : null,
    };
  });
}

function isSchemaError(err) {
  const code = String(err?.code || "");
  const message = String(err?.message || "").toLowerCase();
  return (
    code === "42703" || // undefined_column
    code === "42p01" || // undefined_table
    code === "PGRST204" || // column not found (postgrest)
    code === "PGRST200" || // relationship not found
    message.includes("column") ||
    message.includes("relationship") ||
    message.includes("does not exist")
  );
}

function compactSupabaseError(err) {
  if (!err) return null;
  return {
    code: err.code || "",
    message: err.message || "",
    details: err.details || "",
    hint: err.hint || "",
    status: err.status || "",
  };
}

async function fetchTeacherProfiles(admin, tenant) {
  const attempts = [
    { select: "id, email, display_name, is_active, user_id, created_at", filterKey: "tenant_slug", filterValue: tenant.slug, order: true },
    { select: "id, email, display_name, is_active, created_at", filterKey: "tenant_slug", filterValue: tenant.slug, order: true },
    { select: "id, email, display_name, is_active, user_id", filterKey: "tenant_slug", filterValue: tenant.slug, order: false },
    { select: "id, email, display_name, is_active", filterKey: "tenant_slug", filterValue: tenant.slug, order: false },
    { select: "id, email, display_name, is_active, user_id, created_at", filterKey: "tenant_id", filterValue: tenant.id, order: true },
    { select: "id, email, display_name, is_active, created_at", filterKey: "tenant_id", filterValue: tenant.id, order: true },
    { select: "id, email, display_name, is_active, user_id", filterKey: "tenant_id", filterValue: tenant.id, order: false },
    { select: "id, email, display_name, is_active", filterKey: "tenant_id", filterValue: tenant.id, order: false },
  ];

  let lastError = null;
  let usedAttempt = null;
  for (const attempt of attempts) {
    let query = admin.from("teacher_profiles").select(attempt.select).eq(attempt.filterKey, attempt.filterValue);
    if (attempt.order) query = query.order("created_at", { ascending: false });
    const { data, error } = await query;
    if (!error) {
      const rows = (data || []).map((row) => ({
        ...row,
        user_id: row.user_id || null,
      }));
      return { rows, attempt };
    }
    lastError = error;
    usedAttempt = attempt;
    if (!isSchemaError(error)) break;
  }
  return { rows: null, error: lastError, attempt: usedAttempt };
}

async function fetchTeacherSubjects(admin, profileIds = []) {
  if (!profileIds.length) return { rows: [] };
  const { data, error } = await admin
    .from("teacher_subjects")
    .select("teacher_profile_id, subject:subjects(id, name)")
    .in("teacher_profile_id", profileIds);
  if (!error) return { rows: data || [] };
  if (!isSchemaError(error)) return { rows: null, error };

  const { data: flatRows, error: flatErr } = await admin
    .from("teacher_subjects")
    .select("teacher_profile_id, subject_id")
    .in("teacher_profile_id", profileIds);
  if (flatErr) return { rows: null, error: flatErr };

  const subjectIds = uniq((flatRows || []).map((r) => r.subject_id).filter(Boolean));
  let subjectsById = new Map();
  if (subjectIds.length) {
    const { data: subjects, error: subjectErr } = await admin
      .from("subjects")
      .select("id, name")
      .in("id", subjectIds);
    if (subjectErr) return { rows: null, error: subjectErr };
    subjectsById = new Map((subjects || []).map((s) => [s.id, s]));
  }

  return {
    rows: (flatRows || []).map((r) => ({
      teacher_profile_id: r.teacher_profile_id,
      subject: subjectsById.get(r.subject_id) || null,
    })),
  };
}

async function fetchTeacherGroups(admin, profileIds = []) {
  if (!profileIds.length) return { rows: [] };
  const { data, error } = await admin
    .from("teacher_groups")
    .select("teacher_profile_id, is_tutor, group:groups(id, name, level)")
    .in("teacher_profile_id", profileIds);
  if (!error) return { rows: data || [] };
  if (!isSchemaError(error)) return { rows: null, error };

  const { data: flatRows, error: flatErr } = await admin
    .from("teacher_groups")
    .select("teacher_profile_id, is_tutor, group_id")
    .in("teacher_profile_id", profileIds);
  if (flatErr) return { rows: null, error: flatErr };

  const groupIds = uniq((flatRows || []).map((r) => r.group_id).filter(Boolean));
  let groupsById = new Map();
  if (groupIds.length) {
    const { data: groups, error: groupErr } = await admin
      .from("groups")
      .select("id, name, level")
      .in("id", groupIds);
    if (groupErr) return { rows: null, error: groupErr };
    groupsById = new Map((groups || []).map((g) => [g.id, g]));
  }

  return {
    rows: (flatRows || []).map((r) => ({
      teacher_profile_id: r.teacher_profile_id,
      is_tutor: Boolean(r.is_tutor),
      group: groupsById.get(r.group_id) || null,
    })),
  };
}

export default async function adminTeachersRoutes(app) {
  const createSecurity = makeRouteSecurity({
    env: process.env,
    allowedOriginsEnv: "CHAT_ALLOWED_ORIGINS",
    rateWindowMsEnv: "ADMIN_TEACHERS_RATE_WINDOW_MS",
    rateMaxEnv: "ADMIN_TEACHERS_RATE_MAX",
    routeName: "admin-teachers",
  });
  const tenantMembershipGuard = makeTenantMembershipGuard();

  app.post(
    "/admin/teachers/invite",
    { preHandler: [createSecurity.preHandler, tenantMembershipGuard.preHandler] },
    async (req, reply) => {
      const requestId = req.requestId || makeRequestId();
      const tenantSlug = getTenantSlug(req);

      const auth = await requireRole(req, reply, requestId, {
        tenantSlug,
        roles: ["admin"],
      });
      if (!auth.ok) return;

      const parsed = InviteSchema.safeParse(req.body || {});
      if (!parsed.success) {
        return fail(reply, 400, "invalid_body", "Invalid body", requestId, {
          issues: parsed.error.issues,
        });
      }

      const rl = await rateLimit(req, {
        limit: 40,
        windowSec: 60,
        userId: auth.user.id,
        tenantId: auth.tenant.id,
      });
      reply.header("x-ratelimit-limit", rl.limit);
      reply.header("x-ratelimit-remaining", rl.remaining);
      if (!rl.ok) return fail(reply, 429, "rate_limited", "Too many requests", requestId);

      const admin = createSupabaseAdmin();
      const email = normalizeEmail(parsed.data.email);
      const displayName = String(parsed.data.display_name || "").trim();
      const groupIds = uniq((parsed.data.group_ids || []).filter(Boolean));
      const tutorGroupId = parsed.data.tutor_group_id || null;

      if (tutorGroupId && !groupIds.includes(tutorGroupId)) {
        return fail(reply, 400, "invalid_tutor_group", "tutor_group_id must be in group_ids", requestId);
      }

      const groupsCheck = await ensureGroupsBelongToTenant(admin, auth.tenant.id, groupIds);
      if (!groupsCheck.ok) {
        return fail(reply, 400, groupsCheck.reason, "Invalid groups for tenant", requestId, {
          missing: groupsCheck.missing || [],
        });
      }

      const { data: upsertedProfile, error: profileErr } = await admin
        .from("teacher_profiles")
        .upsert(
          {
            tenant_slug: auth.tenant.slug,
            email,
            display_name: displayName,
            created_by: auth.user.id,
            is_active: true,
          },
          { onConflict: "tenant_slug,email" }
        )
        .select("id, email, display_name")
        .single();

      if (profileErr || !upsertedProfile?.id) {
        return fail(reply, 500, "teacher_profile_upsert_failed", "Failed to upsert teacher profile", requestId);
      }

      try {
        await syncTeacherSubjects(admin, upsertedProfile.id, auth.tenant.slug, parsed.data.subjects || []);
        await syncTeacherGroups(admin, upsertedProfile.id, groupIds, tutorGroupId);
      } catch (e) {
        return fail(reply, 500, e?.message || "teacher_profile_sync_failed", "Failed to sync teacher config", requestId);
      }

      await admin
        .from("teacher_invites")
        .update({ status: "revoked" })
        .eq("tenant_slug", auth.tenant.slug)
        .eq("email", email)
        .eq("status", "pending");

      const code = randomInviteCode();
      const codeHash = hashInviteCode(code);

      const { error: inviteErr } = await admin
        .from("teacher_invites")
        .insert({
          tenant_id: auth.tenant.id,
          tenant_slug: auth.tenant.slug,
          email,
          code_hash: codeHash,
          status: "pending",
          created_by: auth.user.id,
        });

      if (inviteErr) {
        return fail(reply, 500, "teacher_invite_create_failed", "Failed to create teacher invite", requestId);
      }

      return created(
        reply,
        {
          invite: {
            email,
            code,
            status: "pending",
          },
          teacher_profile_id: upsertedProfile.id,
        },
        requestId
      );
    }
  );

  app.get("/admin/teachers", { preHandler: tenantMembershipGuard.preHandler }, async (req, reply) => {
    try {
      const isProd = String(process.env.NODE_ENV || "").toLowerCase() === "production";
      const requestId = req.requestId || makeRequestId();
      const tenantSlug = String(getTenantSlug(req) || "").trim();

      const auth = await requireRole(req, reply, requestId, {
        tenantSlug,
        roles: ["admin"],
      });
      if (!auth.ok) return;
      if (!auth?.tenant?.id || !auth?.tenant?.slug) {
        return fail(reply, 403, "tenant_forbidden", "Tenant forbidden", requestId);
      }

      const rl = await rateLimit(req, {
        limit: 80,
        windowSec: 60,
        userId: auth.user.id,
        tenantId: auth.tenant.id,
      });
      reply.header("x-ratelimit-limit", rl.limit);
      reply.header("x-ratelimit-remaining", rl.remaining);
      if (!rl.ok) return fail(reply, 429, "rate_limited", "Too many requests", requestId);

      const admin = createSupabaseAdmin();
      const warnings = [];
      const profilesResult = await fetchTeacherProfiles(admin, auth.tenant);
      if (profilesResult.error) {
        const supabaseError = compactSupabaseError(profilesResult.error);
        req.log.error(
          {
            requestId,
            path: req.raw?.url || req.url,
            userId: auth.user.id,
            tenantSlug: auth.tenant.slug,
            tenantId: auth.tenant.id,
            attemptedQuery: profilesResult.attempt || null,
            supabaseError,
          },
          "teacher_profiles_fetch_failed"
        );
        const payload = {
          items: [],
          teachers: [],
          warnings: [{ code: "teacher_profiles_fetch_failed", step: "profiles" }],
        };
        if (!isProd) {
          payload.debug = {
            step: "profiles",
            tenantSlug: auth.tenant.slug,
            userId: auth.user.id,
            supabaseError,
            requestId,
          };
        }
        return ok(reply, payload, requestId);
      }
      const profiles = profilesResult.rows || [];

      const profileIds = (profiles || []).map((p) => p.id);
      let subjectRows = [];
      let groupRows = [];

      if (profileIds.length) {
        const [{ rows: subjectsData, error: subjectsErr }, { rows: groupsData, error: groupsErr }] =
          await Promise.all([
            fetchTeacherSubjects(admin, profileIds),
            fetchTeacherGroups(admin, profileIds),
          ]);
        if (subjectsErr) {
          const supabaseError = compactSupabaseError(subjectsErr);
          req.log.error(
            {
              requestId,
              path: req.raw?.url || req.url,
              userId: auth.user.id,
              tenantSlug: auth.tenant.slug,
              tenantId: auth.tenant.id,
              supabaseError,
            },
            "teacher_subjects_fetch_failed"
          );
          warnings.push({ code: "teacher_subjects_fetch_failed", step: "subjects" });
        } else {
          subjectRows = subjectsData || [];
        }
        if (groupsErr) {
          const supabaseError = compactSupabaseError(groupsErr);
          req.log.error(
            {
              requestId,
              path: req.raw?.url || req.url,
              userId: auth.user.id,
              tenantSlug: auth.tenant.slug,
              tenantId: auth.tenant.id,
              supabaseError,
            },
            "teacher_groups_fetch_failed"
          );
          warnings.push({ code: "teacher_groups_fetch_failed", step: "groups" });
        } else {
          groupRows = groupsData || [];
        }
      }

      const { data: invites, error: invitesErr } = await admin
        .from("teacher_invites")
        .select("id, email, status, created_at, used_at, expires_at")
        .eq("tenant_slug", auth.tenant.slug)
        .in("status", ["pending", "used", "revoked", "expired"])
        .order("created_at", { ascending: false });
      let inviteRows = invites || [];
      if (invitesErr) {
        const supabaseError = compactSupabaseError(invitesErr);
        req.log.error(
          {
            requestId,
            path: req.raw?.url || req.url,
            userId: auth.user.id,
            tenantSlug: auth.tenant.slug,
            tenantId: auth.tenant.id,
            supabaseError,
          },
          "teacher_invites_fetch_failed"
        );
        warnings.push({ code: "teacher_invites_fetch_failed", step: "invites" });
        inviteRows = [];
      }

      const teachers = mapTeachers(profiles || [], subjectRows, groupRows, inviteRows || []);
      const payload = { items: teachers, teachers, warnings };
      if (!isProd && warnings.length) {
        payload.debug = {
          requestId,
          tenantSlug: auth.tenant.slug,
          userId: auth.user.id,
          warnings,
        };
      }
      return ok(reply, payload, requestId);
    } catch (err) {
      const requestId = req.requestId || makeRequestId();
      req.log.error({ err, requestId }, "admin teachers list unhandled error");
      return fail(reply, 500, "admin_teachers_failed", "Failed to load admin teachers", requestId);
    }
  });

  app.post(
    "/admin/teachers/teacher-invites/:id/revoke",
    { preHandler: [createSecurity.preHandler, tenantMembershipGuard.preHandler] },
    async (req, reply) => {
      const requestId = req.requestId || makeRequestId();
      const tenantSlug = getTenantSlug(req);

      const auth = await requireRole(req, reply, requestId, {
        tenantSlug,
        roles: ["admin"],
      });
      if (!auth.ok) return;

      const parsedParams = RevokeParamsSchema.safeParse(req.params || {});
      if (!parsedParams.success) {
        return fail(reply, 400, "invalid_params", "Invalid params", requestId, {
          issues: parsedParams.error.issues,
        });
      }

      const admin = createSupabaseAdmin();
      const { data, error } = await admin
        .from("teacher_invites")
        .update({ status: "revoked" })
        .eq("id", parsedParams.data.id)
        .eq("tenant_slug", auth.tenant.slug)
        .eq("status", "pending")
        .select("id, status")
        .maybeSingle();

      if (error) {
        return fail(reply, 500, "teacher_invite_revoke_failed", "Failed to revoke invite", requestId);
      }
      if (!data) {
        return fail(reply, 404, "teacher_invite_not_found", "Invite not found", requestId);
      }

      return ok(reply, data, requestId);
    }
  );
}
