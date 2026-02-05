import crypto from "crypto";
import { z } from "zod";
import { makeRequestId } from "../_lib/requestId.js";
import { ok, fail } from "../_lib/http.js";
import { rateLimit } from "../_lib/rateLimit.js";
import { requireAuth } from "../_lib/auth.js";
import { createSupabaseAdmin } from "../_lib/supabase.js";

const BodySchema = z.object({
  teacher_join_code: z.string().min(4).max(64),
});

function hashTeacherJoinCode(code) {
  const pepper =
    process.env.TEACHER_JOIN_CODE_PEPPER ||
    process.env.JOIN_CODE_PEPPER ||
    process.env.INVITE_CODE_PEPPER ||
    "";
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

  const rl = await rateLimit(req, { limit: 10, windowSec: 60, userId: auth.user.id });
  res.setHeader("x-ratelimit-limit", rl.limit);
  res.setHeader("x-ratelimit-remaining", rl.remaining);
  if (!rl.ok) {
    return fail(res, 429, "rate_limited", "Too many requests", requestId);
  }

  const admin = createSupabaseAdmin();
  const codeHash = hashTeacherJoinCode(parsed.data.teacher_join_code.trim());
  const { data: tenant, error: tenantErr } = await admin
    .from("tenants")
    .select("id, slug, name, teacher_join_code_hash")
    .eq("teacher_join_code_hash", codeHash)
    .maybeSingle();

  if (tenantErr || !tenant) {
    return fail(res, 400, "join_code_invalid", "Invalid teacher code", requestId);
  }

  const { data: membership } = await admin
    .from("tenant_memberships")
    .select("id, role, status")
    .eq("tenant_id", tenant.id)
    .eq("user_id", auth.user.id)
    .maybeSingle();

  if (membership && membership.role !== "teacher" && membership.role !== "admin") {
    return fail(res, 409, "role_conflict", "User already has a different role", requestId);
  }

  if (membership && membership.role === "teacher") {
    return ok(res, {
      status: "approved",
      tenant: { id: tenant.id, slug: tenant.slug, name: tenant.name },
    }, requestId);
  }

  const { data: existingRequest } = await admin
    .from("teacher_requests")
    .select("id, status")
    .eq("tenant_id", tenant.id)
    .eq("requested_by", auth.user.id)
    .maybeSingle();

  if (existingRequest?.status === "pending") {
    return ok(res, {
      status: "pending",
      tenant: { id: tenant.id, slug: tenant.slug, name: tenant.name },
    }, requestId);
  }

  const { error: upsertError } = await admin
    .from("teacher_requests")
    .upsert(
      {
        tenant_id: tenant.id,
        requested_by: auth.user.id,
        email: auth.user.email || null,
        status: "pending",
      },
      { onConflict: "tenant_id,requested_by" }
    );

  if (upsertError) {
    return fail(res, 500, "teacher_request_failed", "Failed to request teacher access", requestId);
  }

  return ok(res, {
    status: "pending",
    tenant: { id: tenant.id, slug: tenant.slug, name: tenant.name },
  }, requestId);
}
