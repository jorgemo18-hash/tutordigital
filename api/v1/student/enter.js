import crypto from "crypto";
import { z } from "zod";
import { makeRequestId } from "../_lib/requestId.js";
import { ok, fail } from "../_lib/http.js";
import { rateLimit } from "../_lib/rateLimit.js";
import { requireAuth } from "../_lib/auth.js";
import { createSupabaseAdmin } from "../_lib/supabase.js";

const EnterSchema = z.object({
  display_name: z.string().min(2).max(80),
  code: z.string().min(4).max(40),
});

function hashCode(code) {
  const pepper = process.env.INVITE_CODE_PEPPER || "";
  return crypto.createHash("sha256").update(pepper + code).digest("hex");
}

export default async function handler(req, res) {
  const requestId = makeRequestId();

  if (req.method !== "POST") {
    return fail(res, 405, "method_not_allowed", "Method not allowed", requestId);
  }

  const auth = await requireAuth(req);
  if (!auth.ok) {
    return fail(res, 401, "unauthorized", "Unauthorized", requestId);
  }

  const parsed = EnterSchema.safeParse(req.body || {});
  if (!parsed.success) {
    return fail(res, 400, "invalid_body", "Invalid body", requestId, {
      issues: parsed.error.issues,
    });
  }

  const rl = await rateLimit(req, {
    limit: 30,
    windowSec: 60,
    userId: auth.user.id,
  });
  res.setHeader("x-ratelimit-limit", rl.limit);
  res.setHeader("x-ratelimit-remaining", rl.remaining);
  if (!rl.ok) return fail(res, 429, "rate_limited", "Too many requests", requestId);

  const admin = createSupabaseAdmin();
  const codeHash = hashCode(parsed.data.code.trim());
  const { data: invite, error: inviteError } = await admin
    .from("invites")
    .select("id, tenant_id, role, code_hash, expires_at, max_uses, used_count, group_id")
    .eq("code_hash", codeHash)
    .maybeSingle();

  if (inviteError || !invite) {
    return fail(res, 400, "invite_invalid", "Invalid code", requestId);
  }
  if (invite.role !== "student") {
    return fail(res, 400, "invite_invalid", "Invalid code", requestId);
  }
  if (invite.expires_at && new Date(invite.expires_at) < new Date()) {
    return fail(res, 400, "invite_expired", "Invite expired", requestId);
  }
  if (invite.used_count >= invite.max_uses) {
    return fail(res, 400, "invite_exhausted", "Invite exhausted", requestId);
  }

  const { data: updated, error: updateError } = await admin
    .from("invites")
    .update({ used_count: invite.used_count + 1 })
    .eq("id", invite.id)
    .lt("used_count", invite.max_uses)
    .select("id, used_count")
    .single();

  if (updateError || !updated) {
    return fail(res, 400, "invite_exhausted", "Invite exhausted", requestId);
  }

  const { data: existingMembership } = await admin
    .from("tenant_memberships")
    .select("id, role, status")
    .eq("tenant_id", invite.tenant_id)
    .eq("user_id", auth.user.id)
    .maybeSingle();

  if (existingMembership && existingMembership.role !== "student") {
    return fail(res, 409, "role_conflict", "User already has a different role", requestId);
  }

  if (!existingMembership) {
    const { error: membershipError } = await admin
      .from("tenant_memberships")
      .insert({
        tenant_id: invite.tenant_id,
        user_id: auth.user.id,
        role: "student",
        status: "active",
      });
    if (membershipError) {
      return fail(res, 500, "membership_create_failed", "Failed to create membership", requestId);
    }
  }

  const { data: existingStudent } = await admin
    .from("students")
    .select("id, display_name, group_id")
    .eq("tenant_id", invite.tenant_id)
    .eq("user_id", auth.user.id)
    .maybeSingle();

  let student = existingStudent;
  if (!student) {
    const { data: createdStudent, error: studentError } = await admin
      .from("students")
      .insert({
        tenant_id: invite.tenant_id,
        user_id: auth.user.id,
        group_id: invite.group_id,
        display_name: parsed.data.display_name,
        status: "pending",
      })
      .select("id, display_name, group_id")
      .single();
    if (studentError) {
      return fail(res, 500, "student_create_failed", "Failed to create student", requestId);
    }
    student = createdStudent;
  }

  return ok(res, {
    student,
    tenant_id: invite.tenant_id,
    group_id: invite.group_id,
  }, requestId);
}
