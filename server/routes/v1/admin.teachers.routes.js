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

const ADMIN_TEACHERS_INVITE_API_VERSION = process.env.TTD_VERSION || "dev";

function normalizeEmail(value) {
  return String(value || "").trim().toLowerCase();
}

function safeStr(value) {
  return typeof value === "string" ? value.trim() : "";
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

function createNoInvitesAdmin(admin) {
  return new Proxy(admin, {
    get(target, prop, receiver) {
      if (prop !== "from") return Reflect.get(target, prop, receiver);
      return (tableName, ...rest) => {
        if (String(tableName) === "invites") {
          throw new Error("BUG: invites path executed");
        }
        return target.from.call(target, tableName, ...rest);
      };
    },
  });
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

function isPgrst205(err) {
  const msg = String(err?.message || err?.details || err?.hint || "");
  const low = msg.toLowerCase();
  return (
    err?.code === "PGRST205" &&
    (low.includes("schema cache") || low.includes("could not find the table")) &&
    low.includes("teacher_invites")
  );
}

function isTeacherInvitesSchemaCacheStale(err) {
  const e = err?.cause || err;
  const code = String(e?.code || "");
  const msg = String(e?.message || e?.details || "").toLowerCase();
  return (
    code === "PGRST204" ||
    code === "PGRST205" ||
    (msg.includes("schema cache") && msg.includes("teacher_invites")) ||
    (msg.includes("schema cache") && msg.includes("column")) ||
    (msg.includes("teacher_invites") && msg.includes("schema cache")) ||
    (msg.includes("teacher_invites") && msg.includes("not in schema cache")) ||
    (msg.includes("teacher_invites") && msg.includes("could not find the table"))
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
    err?.cause?.message,
    err?.cause?.details,
  ]
    .filter(Boolean)
    .join(" | ");
}

function isUnique23505(err) {
  return String(err?.code || err?.cause?.code || "").trim() === "23505";
}

function isActiveUniqueInviteConflict(err) {
  const t = getErrText(err);
  return t.includes("teacher_invites_tenant_email_active_unique");
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
      .select("id, email, code, status, created_at, expires_at, used_at, revoked_at")
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

async function insertTeacherInviteFallback(admin, {
  tenantId,
  email,
  code,
  displayName,
  subjects,
  groupIds,
  tutorGroupId,
}) {
  if (String(process.env.TEST_FORCE_TEACHER_INVITES_PGRST205 || "") === "1") {
    throw {
      code: "PGRST205",
      message: "Could not find the table 'public.teacher_invites' in the schema cache",
    };
  }

  // Canonical insert shape for teacher_invites.
  let { error } = await admin
    .from("teacher_invites")
    .insert({
      tenant_id: tenantId,
      email,
      display_name: displayName || null,
      subjects: Array.isArray(subjects) ? subjects : [],
      group_ids: Array.isArray(groupIds) ? groupIds : [],
      tutor_group_id: tutorGroupId || null,
      code,
      created_at: new Date().toISOString(),
      revoked_at: null,
    });
  if (!error) return code;
  throw error;
}

async function insertInviteWithFallback(admin, params, context = {}) {
  context.log?.info(
    {
      requestId: context.requestId,
      "invite.insert.target": "teacher_invites",
    },
    "teacher_invite_insert_target"
  );
  try {
    await insertTeacherInviteFallback(admin, params);
    return { source: "teacher_invites", code: params.code };
  } catch (err) {
    if (isTeacherInvitesSchemaCacheStale(err) || isPgrst205(err)) {
      throw Object.assign(new Error("schema_cache_stale"), { cause: err });
    }
    throw Object.assign(new Error("teacher_invites_insert_failed"), { cause: err });
  }
}

export const __adminTeachersInviteTestables = {
  createNoInvitesAdmin,
  insertInviteWithFallback,
};

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
      reply.header("x-ttd-version", ADMIN_TEACHERS_INVITE_API_VERSION);

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

      const admin = createNoInvitesAdmin(createSupabaseAdmin());
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

      const code = randomInviteCode();

      try {
        await revokeTeacherInvitesFallback(admin, {
          tenantId: auth.tenant.id,
          tenantSlug: auth.tenant.slug,
          email,
        });

        const inserted = await insertInviteWithFallback(
          admin,
          {
            tenantId: auth.tenant.id,
            tenantSlug: auth.tenant.slug,
            email,
            code,
            userId: auth.user.id,
            displayName,
            subjects,
            groupIds,
            tutorGroupId,
          },
          { log: req.log, requestId }
        );

        return created(
          reply,
          {
            invite: {
              email,
              code: inserted.code,
              source: inserted.source,
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
        console.log("[ADMIN_INVITE_ERR]", {
          code: rawErr?.code,
          msg: rawErr?.message,
          details: rawErr?.details,
          hint: rawErr?.hint,
        });
        try {
          if (isUnique23505(rawErr) && isActiveUniqueInviteConflict(rawErr)) {
            const existingInvite = await findExistingActiveTeacherInvite(admin, {
              tenantId,
              tenantSlug: auth.tenant.slug,
              emailNorm: emailLower,
            });
            if (existingInvite) {
              reply.header("x-ttd-version", ADMIN_TEACHERS_INVITE_API_VERSION);
              return reply.code(200).send({
                ok: true,
                already_exists: true,
                invite: existingInvite,
                apiVersion: ADMIN_TEACHERS_INVITE_API_VERSION,
              });
            }
            reply.header("x-ttd-version", ADMIN_TEACHERS_INVITE_API_VERSION);
            return reply.code(409).send({
              ok: false,
              error: {
                code: "teacher_invite_already_exists",
                message: "Ya existe una invitación activa para ese email en este centro.",
              },
              apiVersion: ADMIN_TEACHERS_INVITE_API_VERSION,
            });
          }
        } catch (_e2) {
          reply.header("x-ttd-version", ADMIN_TEACHERS_INVITE_API_VERSION);
          return reply.code(409).send({
            ok: false,
            error: {
              code: "teacher_invite_already_exists",
              message: "Ya existe una invitación activa para ese email en este centro.",
            },
            apiVersion: ADMIN_TEACHERS_INVITE_API_VERSION,
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
        if (err?.message === "schema_cache_stale") {
          return fail(
            reply,
            503,
            "schema_cache_stale",
            "Schema cache stale for teacher_invites. Run: NOTIFY pgrst, 'reload schema' in Supabase.",
            requestId,
            {
              detail,
              apiVersion: ADMIN_TEACHERS_INVITE_API_VERSION,
            }
          );
        }
        return reply.code(500).send({
          ok: false,
          error: {
            code: "teacher_invite_create_failed",
            message: "Failed to create teacher invite",
            requestId,
            detail,
            apiVersion: ADMIN_TEACHERS_INVITE_API_VERSION,
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
