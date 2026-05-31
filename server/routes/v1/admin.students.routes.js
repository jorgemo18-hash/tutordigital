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
import {
  AddStudentSchema,
  ImportStudentsSchema,
  GroupParamsSchema,
  StudentParamsSchema,
  ResendStudentParamsSchema,
  normalizeEmail,
  generateJoinCode,
  hashJoinCode,
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
        .select("id, email, display_name, status, created_at, group_id, group:groups(id, name)")
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

      const email = normalizeEmail(parsed.data.email);
      const groupId = parsedParams.data.groupId;

      // Generate token and build invite URL directly (no Supabase generateLink)
      const code = randomInviteCode();
      const codeHash = hashInviteCode(code);
      const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(); // 30 days
      const appBaseUrl = getEnv("APP_BASE_URL", "https://tutordigital.app").replace(/\/+$/, "");
      const inviteUrl = `${appBaseUrl}/invite.html?tenant=${encodeURIComponent(auth.tenant.slug)}&token=${encodeURIComponent(code)}&email=${encodeURIComponent(email)}&group=${encodeURIComponent(groupId)}&role=student`;
      req.log.info({ debug_invite: true, email, code, codeHash, inviteUrl }, "student invite created");

      // Upsert student_invites (revoke any prior pending invite for this email+group first)
      await admin
        .from("student_invites")
        .update({ status: "revoked" })
        .eq("group_id", groupId)
        .eq("email", email)
        .eq("status", "pending");

      const { data: inviteRow, error: insertError } = await admin
        .from("student_invites")
        .insert({
          tenant_id:    auth.tenant.id,
          group_id:     groupId,
          email,
          created_by:   auth.user.id,
          code_hash:    codeHash,
          expires_at:   expiresAt,
        })
        .select("id, email, status, created_at")
        .single();

      if (insertError) {
        req.log.error({ err: insertError, requestId }, "admin add student invite failed");
        return fail(reply, 500, "student_invite_failed", "Failed to add student", requestId);
      }

      let emailSent = false;
      try {
        await sendStudentInviteEmail({ to: email, tenantName: auth.tenant.name, groupName: group.name, inviteUrl });
        emailSent = true;
      } catch (emailErr) {
        req.log.warn({ err: emailErr, requestId, email }, "student invite email failed (non-blocking)");
      }

      return created(reply, {
        invite: { id: inviteRow.id, email, invite_url: inviteUrl, status: "pending" },
        email_sent: emailSent,
      }, requestId);
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

  // ── POST /admin/groups/:groupId/students/import ─ importar lista ─────────
  app.post(
    "/admin/groups/:groupId/students/import",
    { preHandler: [createSecurity.preHandler, tenantMembershipGuard.preHandler] },
    async (req, reply) => {
      const requestId = req.requestId || makeRequestId();
      const tenantSlug = getTenantSlug(req);
      reply.header("x-ttd-version", getBuildInfo().label);

      const auth = await requireRole(req, reply, requestId, { tenantSlug, roles: ["admin"] });
      if (!auth.ok) return;

      const parsedParams = GroupParamsSchema.safeParse(req.params || {});
      if (!parsedParams.success) return fail(reply, 400, "invalid_params", "Invalid params", requestId);

      const parsed = ImportStudentsSchema.safeParse(req.body || {});
      if (!parsed.success) return fail(reply, 400, "invalid_body", "Invalid body", requestId, { issues: parsed.error.issues });

      const rl = await rateLimit(req, { limit: 20, windowSec: 60, userId: auth.user.id, tenantId: auth.tenant.id });
      reply.header("x-ratelimit-limit", rl.limit);
      reply.header("x-ratelimit-remaining", rl.remaining);
      if (!rl.ok) return fail(reply, 429, "rate_limited", "Too many requests", requestId);

      const admin = createSupabaseAdmin();
      const group = await assertGroupBelongsToTenant(admin, auth.tenant.id, parsedParams.data.groupId, reply, requestId);
      if (!group) return;

      const emails = [...new Set(parsed.data.emails.map(normalizeEmail).filter(Boolean))];
      const rows = emails.map((email) => ({ tenant_id: auth.tenant.id, group_id: parsedParams.data.groupId, email, created_by: auth.user.id }));

      const { data, error } = await admin
        .from("student_invites")
        .upsert(rows, { onConflict: "group_id,email", ignoreDuplicates: true })
        .select("id, email, status, created_at");

      if (error) {
        req.log.error({ err: error, requestId }, "admin import students failed");
        return fail(reply, 500, "import_failed", "Failed to import students", requestId);
      }

      return created(reply, { imported: (data || []).length, total_submitted: emails.length }, requestId);
    }
  );

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

  // ── POST /admin/groups/:groupId/regenerate-code ─ nuevo código ───────────
  app.post(
    "/admin/groups/:groupId/regenerate-code",
    { preHandler: [createSecurity.preHandler, tenantMembershipGuard.preHandler] },
    async (req, reply) => {
      const requestId = req.requestId || makeRequestId();
      const tenantSlug = getTenantSlug(req);
      reply.header("x-ttd-version", getBuildInfo().label);

      const auth = await requireRole(req, reply, requestId, { tenantSlug, roles: ["admin"] });
      if (!auth.ok) return;

      const parsedParams = GroupParamsSchema.safeParse(req.params || {});
      if (!parsedParams.success) return fail(reply, 400, "invalid_params", "Invalid params", requestId);

      const rl = await rateLimit(req, { limit: 20, windowSec: 60, userId: auth.user.id, tenantId: auth.tenant.id });
      reply.header("x-ratelimit-limit", rl.limit);
      reply.header("x-ratelimit-remaining", rl.remaining);
      if (!rl.ok) return fail(reply, 429, "rate_limited", "Too many requests", requestId);

      const admin = createSupabaseAdmin();
      const group = await assertGroupBelongsToTenant(admin, auth.tenant.id, parsedParams.data.groupId, reply, requestId);
      if (!group) return;

      const joinCode = generateJoinCode();
      const joinCodeHash = hashJoinCode(joinCode);
      const joinCodeHint = joinCode.slice(0, 4);

      const { data, error } = await admin
        .from("groups")
        .update({ join_code_hash: joinCodeHash, join_code_hint: joinCodeHint })
        .eq("id", parsedParams.data.groupId)
        .eq("tenant_id", auth.tenant.id)
        .select("id, name, join_code_hint")
        .single();

      if (error) {
        req.log.error({ err: error, requestId }, "admin regenerate-code failed");
        return fail(reply, 500, "regenerate_code_failed", "Failed to regenerate code", requestId);
      }

      return ok(reply, { group: data, join_code: joinCode }, requestId);
    }
  );
}
