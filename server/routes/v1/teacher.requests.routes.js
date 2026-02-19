import { z } from "zod";
import { makeRequestId } from "../../lib/requestId.js";
import { ok, fail } from "../../lib/http.js";
import { rateLimit } from "../../lib/rateLimit.js";
import { requireRole } from "../../lib/middleware.js";
import { getTenantSlug } from "../../lib/tenantSlug.js";
import { createSupabaseAdmin } from "../../lib/supabase.js";
import { makeTenantMembershipGuard } from "../../lib/security/tenantMembershipGuard.js";

const QuerySchema = z.object({
  status: z.enum(["pending", "approved", "rejected"]).optional(),
});

const PatchSchema = z.object({
  id: z.string().uuid(),
  action: z.enum(["approve", "reject"]),
  reason: z.string().max(200).optional(),
});

export default async function teacherRequestsRoutes(app) {
  const tenantMembershipGuard = makeTenantMembershipGuard();

  const methodNotAllowed = async (req, reply) => {
    const requestId = req.requestId || makeRequestId();
    return fail(reply, 405, "method_not_allowed", "Method not allowed", requestId);
  };

  app.get("/", { preHandler: tenantMembershipGuard.preHandler }, async (req, reply) => {
    const requestId = req.requestId || makeRequestId();
    const tenantSlug = getTenantSlug(req);

    const auth = await requireRole(req, reply, requestId, {
      tenantSlug,
      roles: ["admin"],
    });
    if (!auth.ok) return;

    const parsed = QuerySchema.safeParse(req.query || {});
    if (!parsed.success) {
      return fail(reply, 400, "invalid_query", "Invalid query", requestId, {
        issues: parsed.error.issues,
      });
    }

    const rl = await rateLimit(req, {
      limit: 60,
      windowSec: 60,
      userId: auth.user.id,
      tenantId: auth.tenant.id,
    });
    reply.header("x-ratelimit-limit", rl.limit);
    reply.header("x-ratelimit-remaining", rl.remaining);
    if (!rl.ok) return fail(reply, 429, "rate_limited", "Too many requests", requestId);

    const status = parsed.data.status || "pending";
    const admin = createSupabaseAdmin();
    const { data, error } = await admin
      .from("teacher_requests")
      .select("id, email, status, rejected_reason, created_at, decided_at, requested_by")
      .eq("tenant_id", auth.tenant.id)
      .eq("status", status)
      .order("created_at", { ascending: true });

    if (error) {
      return fail(reply, 500, "teacher_requests_failed", "Failed to load teacher requests", requestId);
    }

    return ok(reply, { items: data || [] }, requestId);
  });

  app.patch("/", { preHandler: tenantMembershipGuard.preHandler }, async (req, reply) => {
    const requestId = req.requestId || makeRequestId();
    const tenantSlug = getTenantSlug(req);

    const auth = await requireRole(req, reply, requestId, {
      tenantSlug,
      roles: ["admin"],
    });
    if (!auth.ok) return;

    const parsed = PatchSchema.safeParse(req.body || {});
    if (!parsed.success) {
      return fail(reply, 400, "invalid_body", "Invalid body", requestId, {
        issues: parsed.error.issues,
      });
    }

    const rl = await rateLimit(req, {
      limit: 60,
      windowSec: 60,
      userId: auth.user.id,
      tenantId: auth.tenant.id,
    });
    reply.header("x-ratelimit-limit", rl.limit);
    reply.header("x-ratelimit-remaining", rl.remaining);
    if (!rl.ok) return fail(reply, 429, "rate_limited", "Too many requests", requestId);

    const admin = createSupabaseAdmin();
    const { id, action, reason } = parsed.data;

    const { data: requestRow, error: requestErr } = await admin
      .from("teacher_requests")
      .select("id, tenant_id, requested_by, status")
      .eq("id", id)
      .eq("tenant_id", auth.tenant.id)
      .maybeSingle();

    if (requestErr || !requestRow) {
      return fail(reply, 404, "teacher_request_not_found", "Teacher request not found", requestId);
    }

    if (action === "approve") {
      const { data: membership, error: membershipErr } = await admin
        .from("tenant_memberships")
        .select("id, role, status")
        .eq("tenant_id", auth.tenant.id)
        .eq("user_id", requestRow.requested_by)
        .maybeSingle();

      if (membershipErr) {
        return fail(reply, 500, "membership_lookup_failed", "Failed to check membership", requestId);
      }

      if (membership && membership.role !== "teacher" && membership.role !== "admin") {
        return fail(reply, 409, "role_conflict", "User already has a different role", requestId);
      }

      if (!membership) {
        const { error: createMembershipErr } = await admin
          .from("tenant_memberships")
          .insert({
            tenant_id: auth.tenant.id,
            user_id: requestRow.requested_by,
            role: "teacher",
            status: "active",
          });

        if (createMembershipErr) {
          return fail(reply, 500, "membership_create_failed", "Failed to create membership", requestId);
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
        return fail(reply, 500, "teacher_request_update_failed", "Failed to approve request", requestId);
      }

      return ok(reply, { id: requestRow.id, status: "approved" }, requestId);
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
      return fail(reply, 500, "teacher_request_update_failed", "Failed to reject request", requestId);
    }

    return ok(reply, { id: requestRow.id, status: "rejected" }, requestId);
  });

  app.post("/", methodNotAllowed);
  app.put("/", methodNotAllowed);
  app.delete("/", methodNotAllowed);
  app.head("/", methodNotAllowed);
}
