import crypto from "crypto";
import { z } from "zod";
import { makeRequestId } from "../_lib/requestId.js";
import { ok, fail } from "../_lib/http.js";
import { rateLimit } from "../_lib/rateLimit.js";
import { requireAuth } from "../_lib/auth.js";
import { createSupabaseAdmin } from "../_lib/supabase.js";

const BodySchema = z.object({
  join_code: z.string().min(4).max(64),
});

function hashJoinCode(code) {
  const pepper = process.env.JOIN_CODE_PEPPER || process.env.INVITE_CODE_PEPPER || "";
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

  const parsed = BodySchema.safeParse(req.body || {});
  if (!parsed.success) {
    return fail(res, 400, "invalid_body", "Invalid body", requestId, {
      issues: parsed.error.issues,
    });
  }

  const rl = await rateLimit(req, { limit: 30, windowSec: 60, userId: auth.user.id });
  res.setHeader("x-ratelimit-limit", rl.limit);
  res.setHeader("x-ratelimit-remaining", rl.remaining);
  if (!rl.ok) {
    return fail(res, 429, "rate_limited", "Too many requests", requestId);
  }

  const admin = createSupabaseAdmin();
  const joinHash = hashJoinCode(parsed.data.join_code.trim());
  const { data: tenant, error: tenantErr } = await admin
    .from("tenants")
    .select("id, slug, name, join_code_hash")
    .eq("join_code_hash", joinHash)
    .maybeSingle();

  if (tenantErr || !tenant) {
    return fail(res, 400, "join_code_invalid", "Invalid join code", requestId);
  }

  const { data: existingMembership } = await admin
    .from("tenant_memberships")
    .select("id, role, status")
    .eq("tenant_id", tenant.id)
    .eq("user_id", auth.user.id)
    .maybeSingle();

  if (existingMembership && existingMembership.role !== "student") {
    return fail(res, 409, "role_conflict", "User already has a different role", requestId);
  }

  if (!existingMembership) {
    const { error: membershipError } = await admin
      .from("tenant_memberships")
      .insert({
        tenant_id: tenant.id,
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
    .select("id, approval_status")
    .eq("tenant_id", tenant.id)
    .eq("user_id", auth.user.id)
    .maybeSingle();

  if (!existingStudent) {
    const { error: studentError } = await admin
      .from("students")
      .insert({
        tenant_id: tenant.id,
        user_id: auth.user.id,
        display_name: auth.user.email || "Alumno",
        status: "pending",
        approval_status: "pending",
      });
    if (studentError) {
      return fail(res, 500, "student_create_failed", "Failed to create student", requestId);
    }
  }

  return ok(res, {
    tenant: { id: tenant.id, slug: tenant.slug, name: tenant.name },
    role: "student",
    approval_status: existingStudent?.approval_status || "pending",
  }, requestId);
}
