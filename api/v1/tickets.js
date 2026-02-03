import { makeRequestId } from "./_lib/requestId.js";
import { ok, created, fail } from "./_lib/http.js";
import { rateLimit } from "./_lib/rateLimit.js";
import { requireRole } from "./_lib/middleware.js";
import { getTenantSlug } from "./_lib/tenantSlug.js";
import { createSupabaseAdmin } from "./_lib/supabase.js";
import {
  TicketsQuerySchema,
  TicketCreateSchema,
  TicketPatchSchema,
} from "./_lib/validators.js";

async function getStudentForUser(admin, tenantId, userId) {
  const { data } = await admin
    .from("students")
    .select("id, group_id")
    .eq("tenant_id", tenantId)
    .eq("user_id", userId)
    .maybeSingle();
  return data || null;
}

export default async function handler(req, res) {
  const requestId = makeRequestId();
  const tenantSlug = getTenantSlug(req);

  if (req.method === "GET") {
    const auth = await requireRole(req, res, requestId, {
      tenantSlug,
      roles: ["admin", "teacher", "student"],
    });
    if (!auth.ok) return;

    const parsed = TicketsQuerySchema.safeParse(req.query || {});
    if (!parsed.success) {
      return fail(res, 400, "invalid_query", "Invalid query", requestId, {
        issues: parsed.error.issues,
      });
    }

    const rl = await rateLimit(req, {
      limit: 120,
      windowSec: 60,
      userId: auth.user.id,
      tenantId: auth.tenant.id,
    });
    res.setHeader("x-ratelimit-limit", rl.limit);
    res.setHeader("x-ratelimit-remaining", rl.remaining);
    if (!rl.ok) return fail(res, 429, "rate_limited", "Too many requests", requestId);

    const admin = createSupabaseAdmin();
    const { limit, offset, status, groupId, studentId } = parsed.data;

    if (auth.membership.role === "student") {
      const student = await getStudentForUser(admin, auth.tenant.id, auth.user.id);
      if (!student) {
        return ok(res, { items: [], limit, offset }, requestId);
      }
      let query = admin
        .from("tickets")
        .select("id, title, detail, status, student_id, group_id, teacher_id, created_at")
        .eq("tenant_id", auth.tenant.id)
        .eq("student_id", student.id)
        .order("created_at", { ascending: false });

      if (status) query = query.eq("status", status);

      const { data, error } = await query.range(offset, offset + limit - 1);
      if (error) {
        return fail(res, 500, "tickets_fetch_failed", "Failed to fetch tickets", requestId);
      }
      return ok(res, { items: data || [], limit, offset }, requestId);
    }

    let query = admin
      .from("tickets")
      .select("id, title, detail, status, student_id, group_id, teacher_id, created_at")
      .eq("tenant_id", auth.tenant.id)
      .order("created_at", { ascending: false });

    if (status) query = query.eq("status", status);
    if (groupId) query = query.eq("group_id", groupId);
    if (studentId) query = query.eq("student_id", studentId);

    const { data, error } = await query.range(offset, offset + limit - 1);
    if (error) {
      return fail(res, 500, "tickets_fetch_failed", "Failed to fetch tickets", requestId);
    }

    return ok(res, { items: data || [], limit, offset }, requestId);
  }

  if (req.method === "POST") {
    const auth = await requireRole(req, res, requestId, {
      tenantSlug,
      roles: ["admin", "teacher", "student"],
    });
    if (!auth.ok) return;

    const parsed = TicketCreateSchema.safeParse(req.body || {});
    if (!parsed.success) {
      return fail(res, 400, "invalid_body", "Invalid body", requestId, {
        issues: parsed.error.issues,
      });
    }

    const rl = await rateLimit(req, {
      limit: 60,
      windowSec: 60,
      userId: auth.user.id,
      tenantId: auth.tenant.id,
    });
    res.setHeader("x-ratelimit-limit", rl.limit);
    res.setHeader("x-ratelimit-remaining", rl.remaining);
    if (!rl.ok) return fail(res, 429, "rate_limited", "Too many requests", requestId);

    const admin = createSupabaseAdmin();
    let studentId = parsed.data.student_id || null;
    let groupId = parsed.data.group_id || null;
    let teacherId = parsed.data.teacher_id || null;

    if (auth.membership.role === "student") {
      const student = await getStudentForUser(admin, auth.tenant.id, auth.user.id);
      if (!student) {
        return fail(res, 403, "student_not_found", "Student not found", requestId);
      }
      studentId = student.id;
      groupId = student.group_id;
      teacherId = null;
    }

    const { data, error } = await admin
      .from("tickets")
      .insert({
        tenant_id: auth.tenant.id,
        title: parsed.data.title,
        detail: parsed.data.detail || null,
        student_id: studentId,
        group_id: groupId,
        teacher_id: teacherId,
        status: "open",
      })
      .select("id, title, detail, status, student_id, group_id, teacher_id, created_at")
      .single();

    if (error) {
      return fail(res, 500, "ticket_create_failed", "Failed to create ticket", requestId);
    }

    return created(res, data, requestId);
  }

  if (req.method === "PATCH") {
    const auth = await requireRole(req, res, requestId, {
      tenantSlug,
      roles: ["admin", "teacher"],
    });
    if (!auth.ok) return;

    const parsed = TicketPatchSchema.safeParse(req.body || {});
    if (!parsed.success) {
      return fail(res, 400, "invalid_body", "Invalid body", requestId, {
        issues: parsed.error.issues,
      });
    }

    const rl = await rateLimit(req, {
      limit: 60,
      windowSec: 60,
      userId: auth.user.id,
      tenantId: auth.tenant.id,
    });
    res.setHeader("x-ratelimit-limit", rl.limit);
    res.setHeader("x-ratelimit-remaining", rl.remaining);
    if (!rl.ok) return fail(res, 429, "rate_limited", "Too many requests", requestId);

    const admin = createSupabaseAdmin();
    const updates = {
      title: parsed.data.title,
      detail: parsed.data.detail,
      status: parsed.data.status,
      teacher_id: parsed.data.teacher_id,
    };
    const { data, error } = await admin
      .from("tickets")
      .update(updates)
      .eq("tenant_id", auth.tenant.id)
      .eq("id", parsed.data.id)
      .select("id, title, detail, status, student_id, group_id, teacher_id, created_at")
      .single();

    if (error) {
      return fail(res, 500, "ticket_update_failed", "Failed to update ticket", requestId);
    }

    return ok(res, data, requestId);
  }

  return fail(res, 405, "method_not_allowed", "Method not allowed", requestId);
}
