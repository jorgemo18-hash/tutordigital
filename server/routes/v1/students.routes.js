import { makeRequestId } from "../../lib/requestId.js";
import { ok, created, fail } from "../../lib/http.js";
import { rateLimit } from "../../lib/rateLimit.js";
import { requireRole } from "../../lib/middleware.js";
import { getTenantSlug } from "../../lib/tenantSlug.js";
import { createSupabaseAdmin } from "../../lib/supabase.js";
import { makeTenantMembershipGuard } from "../../lib/security/tenantMembershipGuard.js";
import {
  StudentsQuerySchema,
  StudentCreateSchema,
  StudentPatchSchema,
} from "../../lib/validators.js";

async function getStudentForUser(admin, tenantId, userId) {
  const { data } = await admin
    .from("students")
    .select("id, group_id, display_name, approval_status")
    .eq("tenant_id", tenantId)
    .eq("user_id", userId)
    .maybeSingle();
  return data || null;
}

export default async function studentsRoutes(app) {
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
      roles: ["admin", "teacher", "student"],
    });
    if (!auth.ok) return;

    const parsed = StudentsQuerySchema.safeParse(req.query || {});
    if (!parsed.success) {
      return fail(reply, 400, "invalid_query", "Invalid query", requestId, {
        issues: parsed.error.issues,
      });
    }

    const rl = await rateLimit(req, {
      limit: 120,
      windowSec: 60,
      userId: auth.user.id,
      tenantId: auth.tenant.id,
    });
    reply.header("x-ratelimit-limit", rl.limit);
    reply.header("x-ratelimit-remaining", rl.remaining);
    if (!rl.ok) return fail(reply, 429, "rate_limited", "Too many requests", requestId);

    const admin = createSupabaseAdmin();
    const { limit, offset, groupId, group_id, approval_status } = parsed.data;
    const finalGroupId = group_id || groupId || null;

    if (auth.membership.role === "student") {
      const student = await getStudentForUser(admin, auth.tenant.id, auth.user.id);
      if (!student) {
        return ok(reply, { items: [], limit, offset }, requestId);
      }
      if (finalGroupId && finalGroupId !== student.group_id) {
        return ok(reply, { items: [], limit, offset }, requestId);
      }
      return ok(reply, { items: [student], limit: 1, offset: 0 }, requestId);
    }

    let query = admin
      .from("students")
      .select("id, display_name, group_id, status, approval_status, rejected_reason, rejected_at, user_id, created_at")
      .eq("tenant_id", auth.tenant.id)
      .order("display_name", { ascending: true });

    if (finalGroupId) query = query.eq("group_id", finalGroupId);
    if (approval_status) query = query.eq("approval_status", approval_status);
    if (approval_status === "approved" && parsed.data.status) {
      query = query.eq("status", parsed.data.status);
    }

    const { data, error } = await query.range(offset, offset + limit - 1);
    if (error) {
      return fail(reply, 500, "students_fetch_failed", "Failed to fetch students", requestId);
    }

    return ok(reply, { items: data || [], limit, offset }, requestId);
  });

  app.post("/", async (req, reply) => {
    const requestId = req.requestId || makeRequestId();
    const tenantSlug = getTenantSlug(req);

    const auth = await requireRole(req, reply, requestId, {
      tenantSlug,
      roles: ["admin", "teacher"],
    });
    if (!auth.ok) return;

    const parsed = StudentCreateSchema.safeParse(req.body || {});
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

    if (parsed.data.group_id) {
      const { data: group } = await admin
        .from("groups")
        .select("id")
        .eq("tenant_id", auth.tenant.id)
        .eq("id", parsed.data.group_id)
        .maybeSingle();
      if (!group) return fail(reply, 404, "group_not_found", "Group not found", requestId);
    }

    const { data, error } = await admin
      .from("students")
      .insert({
        tenant_id: auth.tenant.id,
        display_name: parsed.data.display_name,
        group_id: parsed.data.group_id || null,
        status: parsed.data.status || "pending",
        user_id: parsed.data.user_id || null,
        approval_status: parsed.data.approval_status || "approved",
      })
      .select("id, display_name, group_id, status, approval_status, rejected_reason, rejected_at, user_id, created_at")
      .single();

    if (error) {
      return fail(reply, 500, "student_create_failed", "Failed to create student", requestId);
    }

    return created(reply, data, requestId);
  });

  app.patch("/", async (req, reply) => {
    const requestId = req.requestId || makeRequestId();
    const tenantSlug = getTenantSlug(req);

    const auth = await requireRole(req, reply, requestId, {
      tenantSlug,
      roles: ["admin", "teacher"],
    });
    if (!auth.ok) return;

    const parsed = StudentPatchSchema.safeParse(req.body || {});
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

    if (parsed.data.group_id) {
      const { data: group } = await admin
        .from("groups")
        .select("id")
        .eq("tenant_id", auth.tenant.id)
        .eq("id", parsed.data.group_id)
        .maybeSingle();
      if (!group) return fail(reply, 404, "group_not_found", "Group not found", requestId);
    }

    const updates = {
      display_name: parsed.data.display_name,
      group_id: parsed.data.group_id,
      status: parsed.data.status,
      user_id: parsed.data.user_id,
      approval_status: parsed.data.approval_status,
      rejected_reason: parsed.data.rejected_reason,
    };
    if (parsed.data.approval_status === "approved") {
      updates.approved_at = new Date().toISOString();
      updates.approved_by = auth.user.id;
      updates.rejected_at = null;
      updates.rejected_by = null;
    }
    if (parsed.data.approval_status === "rejected") {
      updates.rejected_at = new Date().toISOString();
      updates.rejected_by = auth.user.id;
    }
    const { data, error } = await admin
      .from("students")
      .update(updates)
      .eq("id", parsed.data.id)
      .eq("tenant_id", auth.tenant.id)
      .select("id, display_name, group_id, status, approval_status, user_id, created_at")
      .single();

    if (error) {
      return fail(reply, 500, "student_update_failed", "Failed to update student", requestId);
    }

    return ok(reply, data, requestId);
  });

  app.delete("/", async (req, reply) => {
    const requestId = req.requestId || makeRequestId();
    const tenantSlug = getTenantSlug(req);

    const auth = await requireRole(req, reply, requestId, {
      tenantSlug,
      roles: ["admin", "teacher"],
    });
    if (!auth.ok) return;

    const id = req?.body?.id || req?.query?.id;
    if (!id) {
      return fail(reply, 400, "invalid_body", "Missing id", requestId);
    }

    const rl = await rateLimit(req, {
      limit: 30,
      windowSec: 60,
      userId: auth.user.id,
      tenantId: auth.tenant.id,
    });
    reply.header("x-ratelimit-limit", rl.limit);
    reply.header("x-ratelimit-remaining", rl.remaining);
    if (!rl.ok) return fail(reply, 429, "rate_limited", "Too many requests", requestId);

    const admin = createSupabaseAdmin();
    const { error } = await admin
      .from("students")
      .delete()
      .eq("tenant_id", auth.tenant.id)
      .eq("id", id);

    if (error) {
      return fail(reply, 500, "student_delete_failed", "Failed to delete student", requestId);
    }

    return ok(reply, { ok: true }, requestId);
  });

  app.put("/", methodNotAllowed);
  app.head("/", methodNotAllowed);
}
