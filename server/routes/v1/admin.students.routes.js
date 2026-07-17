import { makeRequestId } from "../../lib/requestId.js";
import { ok, created, fail } from "../../lib/http.js";
import { rateLimit } from "../../lib/rateLimit.js";
import { requireRole } from "../../lib/middleware.js";
import { getTenantSlug } from "../../lib/tenantSlug.js";
import { createSupabaseAdmin } from "../../lib/supabase.js";
import { makeRouteSecurity } from "../../lib/security/routeGuards.js";
import { makeTenantMembershipGuard } from "../../lib/security/tenantMembershipGuard.js";
import { getBuildInfo } from "../../lib/version.js";
import { getEnv } from "../../lib/env.js";
import { sendStudentInviteEmail } from "../../lib/email.js";
import { createAndSendStudentInvite } from "../../lib/studentInviteCreate.js";
import {
  AddStudentSchema,
  GroupParamsSchema,
  StudentParamsSchema,
  ResendStudentParamsSchema,
  normalizeEmail,
} from "../../lib/adminStudentHelpers.js";
import {
  randomInviteCode,
  hashInviteCode,
} from "../../lib/adminTeacherHelpers.js";

// ── DB helper ─────────────────────────────────────────────────────────────

async function assertGroupBelongsToTenant(admin, tenantId, groupId, reply, requestId) {
  const { data, error } = await admin
    .from("groups")
    .select("id, name, join_code_hint")
    .eq("id", groupId)
    .eq("tenant_id", tenantId)
    .maybeSingle();
  if (error) { fail(reply, 500, "group_lookup_failed", "Failed to lookup group", requestId); return null; }
  if (!data)  { fail(reply, 404, "group_not_found", "Group not found", requestId); return null; }
  return data;
}

// ── Routes ─────────────────────────────────────────────────────────────────

export default async function adminStudentsRoutes(app) {
  const createSecurity = makeRouteSecurity({
    env: process.env,
    allowedOriginsEnv: "ALLOWED_ORIGINS",
    rateWindowMsEnv: "ADMIN_STUDENTS_RATE_WINDOW_MS",
    rateMaxEnv: "ADMIN_STUDENTS_RATE_MAX",
    routeName: "admin-students",
  });
  const tenantMembershipGuard = makeTenantMembershipGuard();

  // ── GET /admin/students ─ todos los alumnos del centro (cross-group) ────
  app.get(
    "/admin/students",
    { preHandler: [createSecurity.preHandler, tenantMembershipGuard.preHandler] },
    async (req, reply) => {
      const requestId = req.requestId || makeRequestId();
      const tenantSlug = getTenantSlug(req);
      reply.header("x-ttd-version", getBuildInfo().label);

      const auth = await requireRole(req, reply, requestId, { tenantSlug, roles: ["admin"] });
      if (!auth.ok) return;

      const rl = await rateLimit(req, { limit: 120, windowSec: 60, userId: auth.user.id, tenantId: auth.tenant.id });
      reply.header("x-ratelimit-limit", rl.limit);
      reply.header("x-ratelimit-remaining", rl.remaining);
      if (!rl.ok) return fail(reply, 429, "rate_limited", "Too many requests", requestId);

      const admin = createSupabaseAdmin();
      const { data, error } = await admin
        .from("student_invites")
        .select("id, email, first_name, last_name, display_name, status, created_at, group_id, group:groups(id, name)")
        .eq("tenant_id", auth.tenant.id)
        .in("status", ["pending", "used"])
        .order("created_at", { ascending: false })
        .limit(500);

      if (error) {
        req.log.error({ err: error, requestId }, "admin all-students fetch failed");
        return fail(reply, 500, "students_fetch_failed", "Failed to fetch students", requestId);
      }

      const items = (data || []).map(row => ({
        id:           row.id,
        email:        row.email,
        first_name:   row.first_name  || null,
        last_name:    row.last_name   || null,
        display_name: row.display_name || null,
        status:       row.status,
        created_at:   row.created_at,
        group_id:     row.group_id,
        group_name:   row.group?.name || null,
      }));

      const pending_count = items.filter(i => i.status === "pending").length;
      return ok(reply, { items, total: items.length, pending_count }, requestId);
    }
  );

  // ── GET /admin/groups/:groupId/students ─ listar alumnos ────────────────
  app.get(
    "/admin/groups/:groupId/students",
    { preHandler: [createSecurity.preHandler, tenantMembershipGuard.preHandler] },
    async (req, reply) => {
      const requestId = req.requestId || makeRequestId();
      const tenantSlug = getTenantSlug(req);
      reply.header("x-ttd-version", getBuildInfo().label);

      const auth = await requireRole(req, reply, requestId, { tenantSlug, roles: ["admin"] });
      if (!auth.ok) return;

      const parsedParams = GroupParamsSchema.safeParse(req.params || {});
      if (!parsedParams.success) return fail(reply, 400, "invalid_params", "Invalid params", requestId);

      const rl = await rateLimit(req, { limit: 120, windowSec: 60, userId: auth.user.id, tenantId: auth.tenant.id });
      reply.header("x-ratelimit-limit", rl.limit);
      reply.header("x-ratelimit-remaining", rl.remaining);
      if (!rl.ok) return fail(reply, 429, "rate_limited", "Too many requests", requestId);

      const admin = createSupabaseAdmin();
      const group = await assertGroupBelongsToTenant(admin, auth.tenant.id, parsedParams.data.groupId, reply, requestId);
      if (!group) return;

      const { data, error } = await admin
        .from("student_invites")
        .select("id, email, status, created_at")
        .eq("group_id", parsedParams.data.groupId)
        .eq("tenant_id", auth.tenant.id)
        .order("created_at", { ascending: false });

      if (error) return fail(reply, 500, "students_fetch_failed", "Failed to fetch students", requestId);
      return ok(reply, { group, items: data || [] }, requestId);
    }
  );

  // ── POST /admin/groups/:groupId/students ─ invitar alumno (magic link) ─────
  app.post(
    "/admin/groups/:groupId/students",
    { preHandler: [createSecurity.preHandler, tenantMembershipGuard.preHandler] },
    async (req, reply) => {
      const requestId = req.requestId || makeRequestId();
      const tenantSlug = getTenantSlug(req);
      reply.header("x-ttd-version", getBuildInfo().label);

      const auth = await requireRole(req, reply, requestId, { tenantSlug, roles: ["admin"] });
      if (!auth.ok) return;

      const parsedParams = GroupParamsSchema.safeParse(req.params || {});
      if (!parsedParams.success) return fail(reply, 400, "invalid_params", "Invalid params", requestId);

      const parsed = AddStudentSchema.safeParse(req.body || {});
      if (!parsed.success) return fail(reply, 400, "invalid_body", "Invalid body", requestId, { issues: parsed.error.issues });

      const rl = await rateLimit(req, { limit: 100, windowSec: 60, userId: auth.user.id, tenantId: auth.tenant.id });
      reply.header("x-ratelimit-limit", rl.limit);
      reply.header("x-ratelimit-remaining", rl.remaining);
      if (!rl.ok) return fail(reply, 429, "rate_limited", "Too many requests", requestId);

      const admin = createSupabaseAdmin();
      const group = await assertGroupBelongsToTenant(admin, auth.tenant.id, parsedParams.data.groupId, reply, requestId);
      if (!group) return;

      const email     = normalizeEmail(parsed.data.email);
      const firstName = String(parsed.data.first_name || "").trim();
      const lastName  = String(parsed.data.last_name  || "").trim();
      const groupId   = parsedParams.data.groupId;

      const result = await createAndSendStudentInvite({
        admin,
        tenantId: auth.tenant.id,
        tenantSlug: auth.tenant.slug,
        tenantName: auth.tenant.name,
        groupId,
        groupName: group.name,
        email,
        firstName,
        lastName,
        createdBy: auth.user.id,
      });

      if (!result.ok) {
        req.log.error({ err: result.error, requestId }, "admin add student invite failed");
        return fail(reply, 500, "student_invite_failed", "Failed to add student", requestId);
      }
      if (!result.email_sent) {
        req.log.warn({ requestId, email }, "student invite email failed (non-blocking)");
      }

      return created(reply, { invite: result.invite, email_sent: result.email_sent }, requestId);
    }
  );

  // ── POST /admin/groups/:groupId/students/:studentId/resend ─ reenviar ─────
  app.post(
    "/admin/groups/:groupId/students/:studentId/resend",
    { preHandler: [createSecurity.preHandler, tenantMembershipGuard.preHandler] },
    async (req, reply) => {
      const requestId = req.requestId || makeRequestId();
      const tenantSlug = getTenantSlug(req);
      reply.header("x-ttd-version", getBuildInfo().label);

      const auth = await requireRole(req, reply, requestId, { tenantSlug, roles: ["admin"] });
      if (!auth.ok) return;

      const parsedParams = ResendStudentParamsSchema.safeParse(req.params || {});
      if (!parsedParams.success) return fail(reply, 400, "invalid_params", "Invalid params", requestId);

      const rl = await rateLimit(req, { limit: 30, windowSec: 60, userId: auth.user.id, tenantId: auth.tenant.id });
      reply.header("x-ratelimit-limit", rl.limit);
      reply.header("x-ratelimit-remaining", rl.remaining);
      if (!rl.ok) return fail(reply, 429, "rate_limited", "Too many requests", requestId);

      const admin = createSupabaseAdmin();
      const { groupId, studentId } = parsedParams.data;

      // Look up the invite
      const { data: invite, error: lookupErr } = await admin
        .from("student_invites")
        .select("id, email, status, group_id, tenant_id")
        .eq("id", studentId)
        .eq("group_id", groupId)
        .eq("tenant_id", auth.tenant.id)
        .maybeSingle();

      if (lookupErr) return fail(reply, 500, "invite_lookup_failed", "Failed to lookup invite", requestId);
      if (!invite) return fail(reply, 404, "invite_not_found", "Invite not found", requestId);
      if (invite.status !== "pending") return fail(reply, 409, "invite_not_pending", "Only pending invites can be resent", requestId);

      const group = await assertGroupBelongsToTenant(admin, auth.tenant.id, groupId, reply, requestId);
      if (!group) return;

      // Regenerate code for security
      const code = randomInviteCode();
      const codeHash = hashInviteCode(code);
      const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
      const appBaseUrl = getEnv("APP_BASE_URL", "https://tutordigital.app").replace(/\/+$/, "");
      const inviteUrl = `${appBaseUrl}/invite.html?tenant=${encodeURIComponent(auth.tenant.slug)}&token=${encodeURIComponent(code)}&email=${encodeURIComponent(invite.email)}&group=${encodeURIComponent(groupId)}&role=student`;

      await admin
        .from("student_invites")
        .update({ code_hash: codeHash, expires_at: expiresAt })
        .eq("id", studentId);

      let emailSent = false;
      try {
        await sendStudentInviteEmail({ to: invite.email, tenantName: auth.tenant.name, groupName: group.name, inviteUrl });
        emailSent = true;
      } catch (emailErr) {
        req.log.warn({ err: emailErr, requestId, email: invite.email }, "student resend email failed (non-blocking)");
      }

      return ok(reply, {
        invite: { id: invite.id, email: invite.email, invite_url: inviteUrl, status: "pending" },
        email_sent: emailSent,
      }, requestId);
    }
  );

  // El import masivo (preview + confirmación) vive en
  // admin.students.import.routes.js — archivo nuevo, ver el comentario de
  // cabecera de ese archivo para el porqué (este ya estaba al límite de
  // 400 líneas antes de que existiera la fase de previsualización).

  // ── DELETE /admin/groups/:groupId/students/:studentId ─ revocar ──────────
  app.delete(
    "/admin/groups/:groupId/students/:studentId",
    { preHandler: [createSecurity.preHandler, tenantMembershipGuard.preHandler] },
    async (req, reply) => {
      const requestId = req.requestId || makeRequestId();
      const tenantSlug = getTenantSlug(req);
      reply.header("x-ttd-version", getBuildInfo().label);

      const auth = await requireRole(req, reply, requestId, { tenantSlug, roles: ["admin"] });
      if (!auth.ok) return;

      const parsedParams = StudentParamsSchema.safeParse(req.params || {});
      if (!parsedParams.success) return fail(reply, 400, "invalid_params", "Invalid params", requestId);

      const rl = await rateLimit(req, { limit: 60, windowSec: 60, userId: auth.user.id, tenantId: auth.tenant.id });
      reply.header("x-ratelimit-limit", rl.limit);
      reply.header("x-ratelimit-remaining", rl.remaining);
      if (!rl.ok) return fail(reply, 429, "rate_limited", "Too many requests", requestId);

      const admin = createSupabaseAdmin();
      const { data, error } = await admin
        .from("student_invites")
        .update({ status: "revoked" })
        .eq("id", parsedParams.data.studentId)
        .eq("group_id", parsedParams.data.groupId)
        .eq("tenant_id", auth.tenant.id)
        .select("id, email, status")
        .maybeSingle();

      if (error) return fail(reply, 500, "revoke_failed", "Failed to revoke student", requestId);
      if (!data) return fail(reply, 404, "student_invite_not_found", "Invite not found", requestId);
      return ok(reply, data, requestId);
    }
  );

  // ── DELETE /admin/students/:studentId ─ borrado RGPD completo ───────────
  app.delete(
    "/admin/students/:studentId",
    { preHandler: [createSecurity.preHandler, tenantMembershipGuard.preHandler] },
    async (req, reply) => {
      const requestId = req.requestId || makeRequestId();
      const tenantSlug = getTenantSlug(req);
      reply.header("x-ttd-version", getBuildInfo().label);

      const auth = await requireRole(req, reply, requestId, { tenantSlug, roles: ["admin"] });
      if (!auth.ok) return;

      const studentId = req.params?.studentId;
      if (!studentId || typeof studentId !== "string") {
        return fail(reply, 400, "invalid_params", "Invalid studentId", requestId);
      }

      const rl = await rateLimit(req, { limit: 20, windowSec: 60, userId: auth.user.id, tenantId: auth.tenant.id });
      reply.header("x-ratelimit-limit", rl.limit);
      reply.header("x-ratelimit-remaining", rl.remaining);
      if (!rl.ok) return fail(reply, 429, "rate_limited", "Too many requests", requestId);

      const admin = createSupabaseAdmin();

      // 1. Verify invite belongs to this tenant
      const { data: invite, error: inviteErr } = await admin
        .from("student_invites")
        .select("id, email, status, tenant_id")
        .eq("id", studentId)
        .eq("tenant_id", auth.tenant.id)
        .maybeSingle();

      if (inviteErr) return fail(reply, 500, "lookup_failed", "Failed to lookup student", requestId);
      if (!invite)   return fail(reply, 404, "student_not_found", "Student not found", requestId);

      // 2. If the invite was accepted (status=used), find and delete the auth user + app data
      if (invite.status === "used") {
        // Find auth user by email
        const { data: userRows } = await admin.rpc("admin_find_user_by_email", { p_email: invite.email });
        const authUserId = userRows?.[0]?.user_id || null;

        if (authUserId) {
          // Delete students record (cascades: tutor_sessions, session_messages, student_notes,
          // student_task_status, tutor_session_maps)
          await admin
            .from("students")
            .delete()
            .eq("user_id", authUserId)
            .eq("tenant_id", auth.tenant.id);

          // Delete tenant membership
          await admin
            .from("tenant_memberships")
            .delete()
            .eq("user_id", authUserId)
            .eq("tenant_id", auth.tenant.id);

          // Delete auth identity (also cascades profiles)
          const { error: authErr } = await admin.auth.admin.deleteUser(authUserId);
          if (authErr) {
            req.log.warn({ err: authErr, requestId, authUserId }, "auth.deleteUser failed (non-blocking)");
          }
        }
      }

      // 3. Delete the invite record itself
      await admin.from("student_invites").delete().eq("id", studentId).eq("tenant_id", auth.tenant.id);

      req.log.info({ requestId, studentId, email: invite.email }, "student deleted (RGPD)");
      return ok(reply, { deleted: true, email: invite.email }, requestId);
    }
  );

  // POST /admin/groups/:groupId/regenerate-code se movió a
  // admin.groups.routes.js (es una operación de grupo, no de alumnos, y
  // este archivo ya rozaba las 400 líneas).
}
