import { makeRequestId } from "./_lib/requestId.js";
import { ok, created, fail } from "./_lib/http.js";
import { rateLimit } from "./_lib/rateLimit.js";
import { requireRole } from "./_lib/middleware.js";
import { getTenantSlug } from "./_lib/tenantSlug.js";
import { createSupabaseAdmin } from "./_lib/supabase.js";
import {
  TasksQuerySchema,
  TaskCreateSchema,
  TaskPatchSchema,
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

async function attachAttachments(admin, tenantId, tasks = []) {
  if (!tasks.length) return tasks;
  const ids = tasks.map((t) => t.id);
  const { data } = await admin
    .from("attachments")
    .select("id, owner_id, file_name, mime, size, storage_path, created_at")
    .eq("tenant_id", tenantId)
    .eq("owner_type", "task")
    .in("owner_id", ids);

  const grouped = new Map();
  (data || []).forEach((att) => {
    const list = grouped.get(att.owner_id) || [];
    list.push(att);
    grouped.set(att.owner_id, list);
  });

  return tasks.map((t) => ({
    ...t,
    attachments: grouped.get(t.id) || [],
  }));
}

function mapTaskRow(row) {
  if (!row) return row;
  return {
    ...row,
    desc: row.description ?? null,
  };
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

    const parsed = TasksQuerySchema.safeParse(req.query || {});
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
    const { limit, offset, groupId, studentId } = parsed.data;

    let finalGroupId = groupId || null;

    if (studentId) {
      const { data: student } = await admin
        .from("students")
        .select("id, group_id")
        .eq("tenant_id", auth.tenant.id)
        .eq("id", studentId)
        .maybeSingle();
      if (!student) {
        return ok(res, { items: [], limit, offset }, requestId);
      }
      finalGroupId = student.group_id;
    }

    if (auth.membership.role === "student") {
      const student = await getStudentForUser(admin, auth.tenant.id, auth.user.id);
      if (!student) {
        return ok(res, { items: [], limit, offset }, requestId);
      }
      finalGroupId = student.group_id;
    }

    let query = admin
      .from("tasks")
      .select("id, group_id, teacher_id, type, title, description, due_date, created_at")
      .eq("tenant_id", auth.tenant.id)
      .order("due_date", { ascending: true });

    if (finalGroupId) query = query.eq("group_id", finalGroupId);

    const { data, error } = await query.range(offset, offset + limit - 1);
    if (error) {
      return fail(res, 500, "tasks_fetch_failed", "Failed to fetch tasks", requestId);
    }

    const withAttachments = await attachAttachments(admin, auth.tenant.id, data || []);
    const mapped = withAttachments.map(mapTaskRow);
    return ok(res, { items: mapped, limit, offset }, requestId);
  }

  if (req.method === "POST") {
    const auth = await requireRole(req, res, requestId, {
      tenantSlug,
      roles: ["admin", "teacher"],
    });
    if (!auth.ok) return;

    const parsed = TaskCreateSchema.safeParse(req.body || {});
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
    const { data, error } = await admin
      .from("tasks")
      .insert({
        tenant_id: auth.tenant.id,
        group_id: parsed.data.group_id,
        teacher_id: auth.user.id,
        type: parsed.data.type,
        title: parsed.data.title,
        description: parsed.data.desc ?? null,
        due_date: parsed.data.due_date || null,
      })
      .select("id, group_id, teacher_id, type, title, description, due_date, created_at")
      .single();

    if (error) {
      return fail(res, 500, "task_create_failed", "Failed to create task", requestId);
    }

    const withAttachments = await attachAttachments(admin, auth.tenant.id, [data]);
    return created(res, mapTaskRow(withAttachments[0]), requestId);
  }

  if (req.method === "PATCH") {
    const auth = await requireRole(req, res, requestId, {
      tenantSlug,
      roles: ["admin", "teacher"],
    });
    if (!auth.ok) return;

    const parsed = TaskPatchSchema.safeParse(req.body || {});
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
    const { student_id, student_status, ...taskFields } = parsed.data;

    if ((student_id && !student_status) || (!student_id && student_status)) {
      return fail(res, 400, "invalid_body", "student_id and student_status must be provided together", requestId);
    }

    if (student_id && student_status) {
      const { data, error } = await admin
        .from("student_task_status")
        .upsert({
          tenant_id: auth.tenant.id,
          task_id: parsed.data.id,
          student_id,
          status: student_status,
        }, { onConflict: "task_id,student_id" })
        .select("id, task_id, student_id, status, updated_at")
        .single();

      if (error) {
        return fail(res, 500, "task_status_update_failed", "Failed to update task status", requestId);
      }
      return ok(res, data, requestId);
    }

    const updates = {
      group_id: taskFields.group_id,
      type: taskFields.type,
      title: taskFields.title,
      description: taskFields.desc ?? null,
      due_date: taskFields.due_date,
    };

    const { data, error } = await admin
      .from("tasks")
      .update(updates)
      .eq("tenant_id", auth.tenant.id)
      .eq("id", parsed.data.id)
      .select("id, group_id, teacher_id, type, title, description, due_date, created_at")
      .single();

    if (error) {
      return fail(res, 500, "task_update_failed", "Failed to update task", requestId);
    }

    const withAttachments = await attachAttachments(admin, auth.tenant.id, [data]);
    return ok(res, mapTaskRow(withAttachments[0]), requestId);
  }

  return fail(res, 405, "method_not_allowed", "Method not allowed", requestId);
}
