import crypto from "crypto";
import { z } from "zod";
import { makeRequestId } from "../_lib/requestId.js";
import { error, json } from "../_lib/response.js";
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
    return error(res, 405, "Method not allowed", "method_not_allowed", requestId);
  }

  const auth = await requireAuth(req);
  if (!auth.ok) {
    const rl = await rateLimit(req, { limit: 20, windowSec: 60 });
    res.setHeader("x-ratelimit-limit", rl.limit);
    res.setHeader("x-ratelimit-remaining", rl.remaining);
    return error(res, 401, "Unauthorized", "unauthorized", requestId);
  }

  const rl = await rateLimit(req, { limit: 10, windowSec: 60, userId: auth.user.id });
  res.setHeader("x-ratelimit-limit", rl.limit);
  res.setHeader("x-ratelimit-remaining", rl.remaining);
  if (!rl.ok) {
    return error(res, 429, "Too many requests", "rate_limited", requestId);
  }

  const parsed = BodySchema.safeParse(req.body || {});
  if (!parsed.success) {
    return error(res, 400, "Invalid body", "invalid_body", requestId, {
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
    return error(res, 500, "Invite lookup failed", "invite_lookup_failed", requestId);
  }
  if (!invite) {
    return error(res, 404, "Invite not found", "invite_not_found", requestId);
  }

  const now = new Date();
  if (invite.expires_at && new Date(invite.expires_at) <= now) {
    return error(res, 410, "Invite expired", "invite_expired", requestId);
  }
  if (invite.used_count >= invite.max_uses) {
    return error(res, 409, "Invite already used", "invite_used", requestId);
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
      return error(res, 500, "Membership creation failed", "membership_create_failed", requestId);
    }
  }

  if (invite.role === "student") {
    const displayName = String(parsed.data.display_name || "").trim();
    if (!displayName) {
      return error(res, 400, "display_name required for students", "display_name_required", requestId);
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
        return error(res, 500, "Student creation failed", "student_create_failed", requestId);
      }
    }
  }

  const { error: updateInviteError } = await admin
    .from("invites")
    .update({ used_count: invite.used_count + 1 })
    .eq("id", invite.id)
    .lt("used_count", invite.max_uses);

  if (updateInviteError) {
    return error(res, 500, "Invite update failed", "invite_update_failed", requestId);
  }

  return json(res, 200, { ok: true }, requestId);
}
