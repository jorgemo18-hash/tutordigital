import { z } from "zod";
import crypto from "node:crypto";
import { makeRequestId } from "../../lib/requestId.js";
import { ok, created, fail } from "../../lib/http.js";
import { rateLimit } from "../../lib/rateLimit.js";
import { requireRole } from "../../lib/middleware.js";
import { getTenantSlug } from "../../lib/tenantSlug.js";
import { createSupabaseAdmin } from "../../lib/supabase.js";
import { makeRouteSecurity } from "../../lib/security/routeGuards.js";
import { syncTeacherSubjects, syncTeacherGroups } from "../../lib/teacherUtils.js";
import { makeTenantMembershipGuard } from "../../lib/security/tenantMembershipGuard.js";
import { getBuildInfo } from "../../lib/version.js";
import { getEnv } from "../../lib/env.js";

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

function hashInviteCode(code = "") {
  const pepper = process.env.INVITE_CODE_PEPPER || process.env.JOIN_CODE_PEPPER || "";
  return crypto.createHash("sha256").update(`${pepper}${String(code).trim()}`).digest("hex");
}

function normalizeEmail(value) {
  return String(value || "").trim().toLowerCase();
}

function safeStr(value) {
  return typeof value === "string" ? value.trim() : "";
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

function formatSbError(err) {
  if (!err) return null;
  return {
    message: err.message || String(err),
    code: err.code || "",
    details: err.details || "",
    hint: err.hint || "",
    status: err.status || "",
  };
}

function isMissingRelation(err) {
  const message = String(err?.message || "");
  return (
    err?.code === "42P01" ||
    err?.code === "PGRST205" ||
    /relation .* does not exist/i.test(message) ||
    /could not find the table/i.test(message)
  );
}

function isRecoverableSchemaError(err) {
  if (!err) return false;
  if (isMissingRelation(err)) return true;
  const code = String(err.code || "");
  return (
    code === "42703" ||
    code === "22P02" ||
    code === "23502" ||
    code === "23514" ||
    code === "PGRST204" ||
    code === "PGRST205"
  );
}

function getErrText(err) {
  return [
    err?.message,
    err?.details,
    err?.hint,
    err?.constraint,
    err?.cause?.constraint,
    err?.cause?.message,
    err?.cause?.details,
  ]
    .filter(Boolean)
    .join(" | ");
}

function isUnique23505(err) {
  let cur = err;
  while (cur) {
    if (String(cur?.code || "").trim() === "23505") return true;
    cur = cur?.cause;
  }
  return false;
}

function isActiveUniqueInviteConflict(err) {
  const t = getErrText(err);
  if (t.includes("teacher_invites_tenant_email_active_uniq")) return true;
  let cur = err;
  while (cur) {
    if (String(cur?.constraint || "").trim() === "teacher_invites_tenant_email_active_uniq") return true;
    cur = cur?.cause;
  }
  return false;
}

function isInviteActiveRow(row) {
  if (!row) return false;
  const status = String(row.status || "").toLowerCase();
  const now = Date.now();
  if (row.used_at) return false;
  if (row.revoked_at) return false;
  if (row.expires_at && new Date(row.expires_at).getTime() <= now) return false;
  if (status && status !== "pending" && status !== "active") return false;
  return true;
}

async function findExistingActiveTeacherInvite(admin, { tenantId, tenantSlug, emailNorm }) {
  const attempts = [
    { filterKey: "tenant_id", filterValue: tenantId },
    { filterKey: "tenant_slug", filterValue: tenantSlug },
  ];

  for (const attempt of attempts) {
    let query = admin
      .from("teacher_invites")
      .select("id, email, status, created_at, expires_at, used_at, revoked_at")
      .eq(attempt.filterKey, attempt.filterValue)
      .ilike("email", emailNorm)
      .order("created_at", { ascending: false })
      .limit(20);
    const { data, error } = await query;
    if (error) continue;
    const existing = (data || []).find(isInviteActiveRow) || null;
    if (existing) return existing;
  }
  return null;
}

async function revokeTeacherInvitesFallback(admin, { tenantId, tenantSlug, email }) {
  let q = admin
    .from("teacher_invites")
    .update({ status: "revoked", revoked_at: new Date().toISOString() })
    .eq("tenant_slug", tenantSlug)
    .eq("email", email)
    .eq("status", "pending");
  let { error } = await q;
  if (error && isRecoverableSchemaError(error)) {
    q = admin
      .from("teacher_invites")
      .update({ status: "revoked", revoked_at: new Date().toISOString() })
      .eq("tenant_id", tenantId)
      .eq("email", email)
      .eq("status", "pending");
    ({ error } = await q);
  }
  if (error && !isRecoverableSchemaError(error)) throw error;
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
    allowedOriginsEnv: "ALLOWED_ORIGINS",
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
      const build = getBuildInfo();
      reply.header("x-ttd-version", build.label);

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
      const email = normalizeEmail(safeStr(parsed.data.email));
      const displayName = safeStr(parsed.data.display_name);
      const subjects = Array.isArray(parsed.data.subjects) ? parsed.data.subjects.map(safeStr).filter(Boolean) : [];
      const groupIds = uniq((parsed.data.group_ids || []).filter(Boolean));
      const tutorGroupId = safeStr(parsed.data.tutor_group_id || "") || null;

      if (!email || !email.includes("@")) {
        return fail(reply, 400, "bad_request", "Email inválido", requestId);
      }
      if (!groupIds.length) {
        return fail(reply, 400, "bad_request", "Selecciona al menos un grupo", requestId);
      }

      if (tutorGroupId && !groupIds.includes(tutorGroupId)) {
        return fail(reply, 400, "invalid_tutor_group", "tutor_group_id must be in group_ids", requestId);
      }

      const groupsCheck = await ensureGroupsBelongToTenant(admin, auth.tenant.id, groupIds);
      if (!groupsCheck.ok) {
        return fail(reply, 400, groupsCheck.reason, "Invalid groups for tenant", requestId, {
          missing: groupsCheck.missing || [],
        });
      }

      try {
        await revokeTeacherInvitesFallback(admin, {
          tenantId: auth.tenant.id,
          tenantSlug: auth.tenant.slug,
          email,
        });

        const code = randomInviteCode();

        const { error: insertError } = await admin
          .from("teacher_invites")
          .insert({
            tenantId: auth.tenant.id,
            tenantSlug: auth.tenant.slug,
            email,
            display_name: displayName,
            subjects,
            group_ids: groupIds,
            tutor_group_id: tutorGroupId,
            code_hash: hashInviteCode(code),
            created_at: new Date().toISOString(),
            revoked_at: null,
          });

        if (insertError) {
          throw Object.assign(new Error("teacher_invites_insert_failed"), { cause: insertError });
        }

        return created(
          reply,
          {
            invite: {
              email,
              code,
              status: "pending",
            },
            teacher_profile_id: null,
            already_exists: false,
          },
          requestId
        );
      } catch (err) {
        const rawErr = err?.cause || err;
        const tenantId = auth.tenant.id;
        const emailLower = email;
        try {
          if (isUnique23505(err) && isActiveUniqueInviteConflict(err)) {
            const existingInvite = await findExistingActiveTeacherInvite(admin, {
              tenantId,
              tenantSlug: auth.tenant.slug,
              emailNorm: emailLower,
            });
            if (existingInvite) {
              reply.header("x-ttd-version", build.label);
              return reply.code(200).send({
                ok: true,
                already_exists: true,
                invite: {
                  id: existingInvite.id,
                  email: existingInvite.email,
                  status: existingInvite.status,
                  created_at: existingInvite.created_at,
                  used_at: existingInvite.used_at,
                  expires_at: existingInvite.expires_at,
                },
                apiVersion: build.label,
              });
            }
            reply.header("x-ttd-version", build.label);
            return reply.code(409).send({
              ok: false,
              error: {
                code: "teacher_invite_already_exists",
                message: "Ya existe una invitación activa para ese email en este centro.",
              },
              apiVersion: build.label,
            });
          }
        } catch (_e2) {
          reply.header("x-ttd-version", build.label);
          return reply.code(409).send({
            ok: false,
            error: {
              code: "teacher_invite_already_exists",
              message: "Ya existe una invitación activa para ese email en este centro.",
            },
            apiVersion: build.label,
          });
        }
        const detail = formatSbError(rawErr);
        req.log.error(
          {
            requestId,
            path: req.raw?.url || req.url,
            tenantSlug: auth.tenant.slug,
            tenantId: auth.tenant.id,
            userId: auth.user.id,
            inviteErrorMessage: rawErr?.message || String(rawErr || ""),
            inviteErrorCode: rawErr?.code || "",
            err: detail,
          },
          "teacher_invite_create_failed"
        );
        return reply.code(500).send({
          ok: false,
          error: {
            code: "teacher_invite_create_failed",
            message: "Failed to create teacher invite",
            requestId,
            detail,
            apiVersion: build.label,
          },
        });
      }
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
