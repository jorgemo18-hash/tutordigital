import { makeRequestId } from "../../../lib/requestId.js";
import { ok, fail } from "../../../lib/http.js";
import { rateLimit } from "../../../lib/rateLimit.js";
import { requireRole } from "../../../lib/middleware.js";
import { getTenantSlug } from "../../../lib/tenantSlug.js";
import { createSupabaseAdmin } from "../../../lib/supabase.js";
import { makeTenantMembershipGuard } from "../../../lib/security/tenantMembershipGuard.js";
import { compactSupabaseError, mapTeachers } from "../../../lib/adminTeacherHelpers.js";
import {
  fetchTeacherProfiles,
  fetchTeacherSubjects,
  fetchTeacherGroups,
  fetchTeacherGroupSubjects,
} from "../../../lib/adminTeacherQueries.js";

// GET /admin/teachers — extraído de admin.teachers.routes.js. Genérico por
// tenant_slug: para un tenant de academia simplemente no hay filas en
// subjects/groups, así que esos arrays llegan vacíos (mapTeachers los
// tolera sin problema) — no hace falta ninguna rama especial aquí.
export default async function adminTeachersListadoRoutes(app) {
  const tenantMembershipGuard = makeTenantMembershipGuard();

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
        .select("id, email, display_name, status, created_at, used_at, expires_at")
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
}
