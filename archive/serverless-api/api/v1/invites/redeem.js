import crypto from "crypto";
import { z } from "zod";
import { makeRequestId } from "../_lib/requestId.js";
import { ok, fail } from "../_lib/http.js";
import { rateLimit } from "../_lib/rateLimit.js";
import { requireAuth } from "../_lib/auth.js";
import { createSupabaseAdmin } from "../_lib/supabase.js";

const BodySchema = z.object({
  code: z.string().min(6).max(128),
  display_name: z.string().min(2).max(80).optional(),
});

function hashCode(code = "") {
  return crypto.createHash("sha256").update(String(code).trim()).digest("hex");
}

export default async function handler(req, res) {
  const requestId = makeRequestId();
  if (req.method !== "POST") {
    return fail(res, 405, "method_not_allowed", "Method not allowed", requestId);
  }

  const auth = await requireAuth(req);
  if (!auth.ok) {
    const rl = await rateLimit(req, { limit: 20, windowSec: 60 });
    res.setHeader("x-ratelimit-limit", rl.limit);
    res.setHeader("x-ratelimit-remaining", rl.remaining);
    return fail(res, 401, "unauthorized", "Unauthorized", requestId);
  }

  const rl = await rateLimit(req, { limit: 10, windowSec: 60, userId: auth.user.id });
  res.setHeader("x-ratelimit-limit", rl.limit);
  res.setHeader("x-ratelimit-remaining", rl.remaining);
  if (!rl.ok) {
    return fail(res, 429, "rate_limited", "Too many requests", requestId);
  }

  const parsed = BodySchema.safeParse(req.body || {});
  if (!parsed.success) {
    return fail(res, 400, "invalid_body", "Invalid body", requestId, {
      issues: parsed.error.issues,
    });
  }

  const admin = createSupabaseAdmin();
  const codeHash = hashCode(parsed.data.code);

  const { data: invite, error: inviteError } = await admin
    .from("invites")
    .select("id, tenant_id, role, expires_at, max_uses, used_count, group_id")
    .eq("code_hash", codeHash)
    .maybeSingle();

  if (inviteError) {
    return fail(res, 500, "invite_lookup_failed", "Invite lookup failed", requestId);
  }
  if (!invite) {
    return fail(res, 404, "invite_not_found", "Invite not found", requestId);
  }

  const now = new Date();
  if (invite.expires_at && new Date(invite.expires_at) <= now) {
    return fail(res, 410, "invite_expired", "Invite expired", requestId);
  }
  if (invite.used_count >= invite.max_uses) {
    return fail(res, 409, "invite_used", "Invite already used", requestId);
  }

  const { data: existingMembership } = await admin
    .from("tenant_memberships")
    .select("id")
    .eq("tenant_id", invite.tenant_id)
    .eq("user_id", auth.user.id)
    .maybeSingle();

  if (!existingMembership) {
    const { error: createMemberError } = await admin
      .from("tenant_memberships")
      .insert({
        tenant_id: invite.tenant_id,
        user_id: auth.user.id,
        role: invite.role,
        status: "active",
      });

    if (createMemberError) {
      return fail(res, 500, "membership_create_failed", "Membership creation failed", requestId);
    }
  }

  if (invite.role === "student") {
    const displayName = String(parsed.data.display_name || "").trim();
    if (!displayName) {
      return fail(res, 400, "display_name_required", "display_name required for students", requestId);
    }
    const { data: existingStudent } = await admin
      .from("students")
      .select("id")
      .eq("tenant_id", invite.tenant_id)
      .eq("user_id", auth.user.id)
      .maybeSingle();
    if (!existingStudent) {
      const { error: studentError } = await admin
        .from("students")
        .insert({
          tenant_id: invite.tenant_id,
          user_id: auth.user.id,
          group_id: invite.group_id,
          display_name: displayName,
        });
      if (studentError) {
        return fail(res, 500, "student_create_failed", "Student creation failed", requestId);
      }
    }
  }

  const { error: updateInviteError } = await admin
    .from("invites")
    .update({ used_count: invite.used_count + 1 })
    .eq("id", invite.id)
    .lt("used_count", invite.max_uses);

  if (updateInviteError) {
    return fail(res, 500, "invite_update_failed", "Invite update failed", requestId);
  }

  return ok(res, { ok: true }, requestId);
}
