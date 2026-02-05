import { z } from "zod";
import { makeRequestId } from "../_lib/requestId.js";
import { ok, fail } from "../_lib/http.js";
import { rateLimit } from "../_lib/rateLimit.js";
import { requireAuth, getMembership } from "../_lib/auth.js";
import { createSupabaseAdmin } from "../_lib/supabase.js";
import { getTenantSlug } from "../_lib/tenantSlug.js";
import { resolveTenantForUser } from "../_lib/tenant.js";

const QuerySchema = z.object({
  status: z.enum(["pending", "approved", "rejected"]).optional(),
}).passthrough();

const PatchSchema = z.object({
  id: z.string().uuid(),
  action: z.enum(["approve", "reject"]),
  reason: z.string().max(200).optional(),
});

export default async function handler(req, res) {
  const requestId = makeRequestId();
  const tenantSlug = getTenantSlug(req);

  if (req.method !== "GET" && req.method !== "PATCH") {
    return fail(res, 405, "method_not_allowed", "Method not allowed", requestId);
  }

  const auth = await requireAuth(req);
  if (!auth.ok) {
    return fail(res, 401, "unauthorized", "Unauthorized", requestId);
  }

  const rl = await rateLimit(req, { limit: 60, windowSec: 60, userId: auth.user.id });
  res.setHeader("x-ratelimit-limit", rl.limit);
  res.setHeader("x-ratelimit-remaining", rl.remaining);
  if (!rl.ok) {
    return fail(res, 429, "rate_limited", "Too many requests", requestId);
  }

  const resolved = await resolveTenantForUser({
    userId: auth.user.id,
    tenantSlug,
    allowedRoles: ["admin"],
  });
  if (!resolved.ok) {
    const code = resolved.error || "tenant_forbidden";
    const status = resolved.status || 403;
    const message = code === "tenant_slug_required" ? "Tenant slug required" : "Forbidden";
    return fail(res, status, code, message, requestId);
  }

  const admin = createSupabaseAdmin();

  if (req.method === "GET") {
    const parsed = QuerySchema.safeParse(req.query || {});
    if (!parsed.success) {
      return fail(res, 400, "invalid_query", "Invalid query", requestId, {
        issues: parsed.error.issues,
      });
    }
    const status = parsed.data.status || "pending";
    const { data, error } = await admin
      .from("teacher_requests")
      .select("id, email, status, rejected_reason, created_at, decided_at, requested_by")
      .eq("tenant_id", resolved.tenant.id)
      .eq("status", status)
      .order("created_at", { ascending: true });

    if (error) {
      return fail(res, 500, "teacher_requests_failed", "Failed to load teacher requests", requestId);
    }

    return ok(res, { items: data || [] }, requestId);
  }

  const parsed = PatchSchema.safeParse(req.body || {});
  if (!parsed.success) {
    return fail(res, 400, "invalid_body", "Invalid body", requestId, {
      issues: parsed.error.issues,
    });
  }

  const { id, action, reason } = parsed.data;
  const { data: requestRow, error: requestErr } = await admin
    .from("teacher_requests")
    .select("id, tenant_id, requested_by, status")
    .eq("id", id)
    .eq("tenant_id", resolved.tenant.id)
    .maybeSingle();

  if (requestErr || !requestRow) {
    return fail(res, 404, "teacher_request_not_found", "Teacher request not found", requestId);
  }

  if (action === "approve") {
    const { membership } = await getMembership({
      userId: requestRow.requested_by,
      tenantId: resolved.tenant.id,
    });

    if (membership && membership.role !== "teacher" && membership.role !== "admin") {
      return fail(res, 409, "role_conflict", "User already has a different role", requestId);
    }

    if (!membership) {
      const { error: membershipErr } = await admin
        .from("tenant_memberships")
        .insert({
          tenant_id: resolved.tenant.id,
          user_id: requestRow.requested_by,
          role: "teacher",
          status: "active",
        });
      if (membershipErr) {
        return fail(res, 500, "membership_create_failed", "Failed to create membership", requestId);
      }
    }

    const { error: updateErr } = await admin
      .from("teacher_requests")
      .update({
        status: "approved",
        decided_by: auth.user.id,
        decided_at: new Date().toISOString(),
        rejected_reason: null,
      })
      .eq("id", requestRow.id);
    if (updateErr) {
      return fail(res, 500, "teacher_request_update_failed", "Failed to approve request", requestId);
    }

    return ok(res, { id: requestRow.id, status: "approved" }, requestId);
  }

  const { error: rejectErr } = await admin
    .from("teacher_requests")
    .update({
      status: "rejected",
      decided_by: auth.user.id,
      decided_at: new Date().toISOString(),
      rejected_reason: reason || null,
    })
    .eq("id", requestRow.id);
  if (rejectErr) {
    return fail(res, 500, "teacher_request_update_failed", "Failed to reject request", requestId);
  }

  return ok(res, { id: requestRow.id, status: "rejected" }, requestId);
}
