import crypto from "node:crypto";
import { z } from "zod";
import { makeRequestId } from "../../lib/requestId.js";
import { ok, fail } from "../../lib/http.js";
import { rateLimit } from "../../lib/rateLimit.js";
import { requireAuth } from "../../lib/auth.js";
import { createSupabaseAdmin } from "../../lib/supabase.js";
import { makeRouteSecurity } from "../../lib/security/routeGuards.js";

function hashInviteCode(code = "") {
  const pepper = process.env.INVITE_CODE_PEPPER || process.env.JOIN_CODE_PEPPER || "";
  return crypto.createHash("sha256").update(`${pepper}${String(code).trim()}`).digest("hex");
}

const RedeemSchema = z.object({
  token:    z.string().min(1),
  group_id: z.string().uuid(),
});

export default async function studentInviteRoutes(app) {
  const security = makeRouteSecurity({
    env: process.env,
    allowedOriginsEnv: "CHAT_ALLOWED_ORIGINS",
    rateWindowMsEnv:   "STUDENT_REGISTER_RATE_WINDOW_MS",
    rateMaxEnv:        "STUDENT_REGISTER_RATE_MAX",
    routeName:         "student-invite-redeem",
  });

  // POST /api/v1/student/invite/redeem
  // Called from invite.html after the magic link session is established.
  // Verifies the custom token, creates membership + student record, marks invite used.
  app.post("/student/invite/redeem", { preHandler: security.preHandler }, async (req, reply) => {
    const requestId = req.requestId || makeRequestId();

    const auth = await requireAuth(req);
    if (!auth.ok || !auth.user?.id) {
      return fail(reply, 401, "unauthorized", "Unauthorized", requestId);
    }

    req.log.info({ debug_redeem: true, rawBody: req.body }, "student invite redeem: raw body received");

    const parsed = RedeemSchema.safeParse(req.body || {});
    if (!parsed.success) {
      return fail(reply, 400, "invalid_body", "Invalid body", requestId, { issues: parsed.error.issues });
    }

    const rl = await rateLimit(req, { limit: 20, windowSec: 60, userId: auth.user.id });
    reply.header("x-ratelimit-limit", rl.limit);
    reply.header("x-ratelimit-remaining", rl.remaining);
    if (!rl.ok) return fail(reply, 429, "rate_limited", "Too many requests", requestId);

    const admin = createSupabaseAdmin();
    const email = String(auth.user.email || "").trim().toLowerCase();
    const { token, group_id } = parsed.data;

    // 1. Look up the pending invite
    const { data: invite, error: inviteErr } = await admin
      .from("student_invites")
      .select("id, tenant_id, group_id, email, code_hash, expires_at, display_name, status")
      .eq("email", email)
      .eq("group_id", group_id)
      .eq("status", "pending")
      .order("created_at", { ascending: false })
      .maybeSingle();

    if (inviteErr) {
      req.log.error({ err: inviteErr, requestId }, "student_invite_redeem: lookup failed");
      return fail(reply, 500, "invite_lookup_failed", "Failed to lookup invite", requestId);
    }
    if (!invite) {
      return fail(reply, 400, "invite_not_found", "No pending invite found for this email and group", requestId);
    }

    // 2. Verify expiry
    if (invite.expires_at && new Date(invite.expires_at).getTime() <= Date.now()) {
      await admin.from("student_invites").update({ status: "expired" }).eq("id", invite.id);
      return fail(reply, 400, "invite_expired", "This invite link has expired. Ask your teacher to send a new one.", requestId);
    }

    // 3. Verify token (only when code_hash is set — bulk-imported invites have no hash)
    if (invite.code_hash) {
      const expectedHash = hashInviteCode(token);
      req.log.info(
        { debug_redeem: true, tokenReceived: token, tokenLength: token.length, expectedHash, storedHash: invite.code_hash, match: expectedHash === invite.code_hash },
        "student invite redeem: token check"
      );
      if (expectedHash !== invite.code_hash) {
        return fail(reply, 400, "invite_invalid", "Invalid invite token", requestId);
      }
    }

    // 4. Resolve tenant
    const { data: tenant, error: tenantErr } = await admin
      .from("tenants")
      .select("id, slug, name")
      .eq("id", invite.tenant_id)
      .maybeSingle();

    if (tenantErr || !tenant) {
      return fail(reply, 500, "tenant_lookup_failed", "Failed to resolve tenant", requestId);
    }

    // 5. Create / activate student membership
    const { data: existingMembership } = await admin
      .from("tenant_memberships")
      .select("id, role, status")
      .eq("tenant_id", tenant.id)
      .eq("user_id", auth.user.id)
      .eq("role", "student")
      .maybeSingle();

    if (!existingMembership) {
      const { error: memberErr } = await admin.from("tenant_memberships").insert({
        tenant_id: tenant.id,
        user_id:   auth.user.id,
        role:      "student",
        status:    "active",
      });
      if (memberErr && memberErr.code !== "23505") {
        req.log.error({ err: memberErr, requestId }, "student_invite_redeem: membership create failed");
        return fail(reply, 500, "membership_create_failed", "Failed to activate membership", requestId);
      }
    } else if (existingMembership.status !== "active") {
      await admin
        .from("tenant_memberships")
        .update({ status: "active" })
        .eq("id", existingMembership.id);
    }

    // 6. Resolve group name for the student record
    const { data: group } = await admin
      .from("groups")
      .select("id, name")
      .eq("id", group_id)
      .maybeSingle();

    // 7. Create student record (upsert: user might already belong to another group)
    const displayName = invite.display_name || email.split("@")[0];
    const { error: studentErr } = await admin.from("students").insert({
      tenant_id:       tenant.id,
      user_id:         auth.user.id,
      group_id:        group_id,
      display_name:    displayName,
      status:          "pending",
      approval_status: "approved",  // whitelist = auto-approved
    });

    if (studentErr && studentErr.code !== "23505") {
      req.log.error({ err: studentErr, requestId }, "student_invite_redeem: student record failed");
      return fail(reply, 500, "student_create_failed", "Failed to create student record", requestId);
    }

    // 8. Mark invite as used
    await admin
      .from("student_invites")
      .update({ status: "used" })
      .eq("id", invite.id);

    return ok(
      reply,
      {
        status: "active",
        tenant: { id: tenant.id, slug: tenant.slug, name: tenant.name },
        group:  { id: group_id, name: group?.name || "" },
        role:   "student",
        route:  "/assets/student/",
      },
      requestId
    );
  });
}
