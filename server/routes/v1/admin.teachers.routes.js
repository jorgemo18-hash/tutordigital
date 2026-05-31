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
import {
  InviteSchema,
  RevokeParamsSchema,
  hashInviteCode,
  normalizeEmail,
  safeStr,
  uniq,
  randomInviteCode,
  compactSupabaseError,
  formatSbError,
  isUnique23505,
  isActiveUniqueInviteConflict,
  mapTeachers,
} from "../../lib/adminTeacherHelpers.js";
import {
  ensureGroupsBelongToTenant,
  findExistingActiveTeacherInvite,
  revokeTeacherInvitesFallback,
  fetchTeacherProfiles,
  fetchTeacherSubjects,
  fetchTeacherGroups,
  fetchTeacherGroupSubjects,
} from "../../lib/adminTeacherQueries.js";

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
      const email = String(parsed.data.email || "").trim().toLowerCase();
      const displayName = safeStr(parsed.data.display_name);
      const tutorGroupId = safeStr(parsed.data.tutor_group_id || "") || null;

      // Assignments (new) take precedence over legacy subjects+group_ids
      const rawAssignments = Array.isArray(parsed.data.assignments) ? parsed.data.assignments : null;
      let subjects, groupIds;
      if (rawAssignments && rawAssignments.length) {
        subjects = uniq(rawAssignments.map(a => safeStr(a.subject)).filter(Boolean));
        groupIds = uniq(rawAssignments.flatMap(a => (a.group_ids || []).filter(Boolean)));
      } else {
        subjects = Array.isArray(parsed.data.subjects) ? parsed.data.subjects.map(safeStr).filter(Boolean) : [];
        groupIds = uniq((parsed.data.group_ids || []).filter(Boolean));
      }

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
        const codeHash = hashInviteCode(code);
        const appBaseUrl = getEnv("APP_BASE_URL", "https://tutordigital.app").replace(/\/+$/, "");
        const redirectTo = `${appBaseUrl}/invite.html?tenant=${encodeURIComponent(auth.tenant.slug)}&token=${encodeURIComponent(code)}&email=${encodeURIComponent(email)}`;

        const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

        const { error: insertError } = await admin
          .from("teacher_invites")
          .insert({
            tenant_id: auth.tenant.id,
            tenant_slug: auth.tenant.slug,
            email,
            display_name: displayName,
            subjects,
            group_ids: groupIds,
            assignments: rawAssignments || null,
            tutor_group_id: tutorGroupId,
            code_hash: codeHash,
            expires_at: expiresAt,
            created_at: new Date().toISOString(),
            revoked_at: null,
          });

        if (insertError) {
          throw Object.assign(new Error("teacher_invites_insert_failed"), { cause: insertError });
        }

        const { error: inviteUserError } = await admin.auth.admin.inviteUserByEmail(email, { redirectTo });
        if (inviteUserError) {
          req.log.error({ err: inviteUserError, requestId, email }, "supabase_invite_user_by_email_failed");
          if (
            inviteUserError.code === "email_exists" ||
            String(inviteUserError.message || "").includes("User already registered")
          ) {
            return fail(reply, 409, "user_already_registered", "Este email ya está registrado en el sistema.", requestId);
          }
          // Email dispatch failed but the teacher_invites row already exists — return the URL so admin can share manually
          return created(
            reply,
            {
              invite: { email, invite_url: redirectTo, status: "pending" },
              email_sent: false,
              teacher_profile_id: null,
              already_exists: false,
            },
            requestId
          );
        }

        return created(
          reply,
          {
            invite: { email, invite_url: redirectTo, status: "pending" },
            email_sent: true,
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
      let groupSubjectRows = [];

      if (profileIds.length) {
        const [
          { rows: subjectsData, error: subjectsErr },
          { rows: groupsData, error: groupsErr },
          { rows: groupSubjectsData },
        ] = await Promise.all([
          fetchTeacherSubjects(admin, profileIds),
          fetchTeacherGroups(admin, profileIds),
          fetchTeacherGroupSubjects(admin, profileIds),
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
        groupSubjectRows = groupSubjectsData || [];
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

      const teachers = mapTeachers(profiles || [], subjectRows, groupRows, inviteRows || [], groupSubjectRows);
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
        .eq("tenant_id", auth.tenant.id)
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
