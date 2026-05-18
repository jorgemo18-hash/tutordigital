import { z } from "zod";
import { makeRequestId } from "../../lib/requestId.js";
import { ok, created, fail } from "../../lib/http.js";
import { rateLimit } from "../../lib/rateLimit.js";
import { requireRole } from "../../lib/middleware.js";
import { getTenantSlug } from "../../lib/tenantSlug.js";
import { createSupabaseAdmin } from "../../lib/supabase.js";
import { makeTenantMembershipGuard } from "../../lib/security/tenantMembershipGuard.js";
import {
  TasksQuerySchema,
  TaskCreateSchema,
  TaskPatchSchema,
} from "../../lib/validators.js";

const TaskDeleteSchema = z.object({
  id: z.string().uuid(),
});

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
    .select("id, owner_id, uploader_id, file_name, mime, size, storage_path, created_at")
    .eq("tenant_id", tenantId)
    .eq("owner_type", "task")
    .in("owner_id", ids);

  // Build a map from task id → teacher_id so we can filter student uploads out
  const teacherById = new Map(tasks.map((t) => [t.id, t.teacher_id]));

  const grouped = new Map();
  (data || []).forEach((att) => {
    const teacherId = teacherById.get(att.owner_id);
    // Only include attachments uploaded by the task's teacher (skip student uploads)
    if (teacherId && att.uploader_id !== teacherId) return;
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
    subject_name: row.subject_name ?? null,
  };
}

export default async function tasksRoutes(app) {
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

    const parsed = TasksQuerySchema.safeParse(req.query || {});
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
    const { limit, offset, groupId, group_id, studentId } = parsed.data;

    let finalGroupId = group_id || groupId || null;

    if (studentId) {
      const { data: student } = await admin
        .from("students")
        .select("id, group_id")
        .eq("tenant_id", auth.tenant.id)
        .eq("id", studentId)
        .maybeSingle();
      if (!student) {
        return ok(reply, { items: [], limit, offset }, requestId);
      }
      finalGroupId = student.group_id;
    }

    let currentStudent = null;
    if (auth.membership.role === "student") {
      currentStudent = await getStudentForUser(admin, auth.tenant.id, auth.user.id);
      if (!currentStudent) {
        return ok(reply, { items: [], limit, offset }, requestId);
      }
      finalGroupId = currentStudent.group_id;
    }

    let query = admin
      .from("tasks")
      .select("id, group_id, teacher_id, type, title, description, subject_name, due_date, created_at")
      .eq("tenant_id", auth.tenant.id)
      .order("due_date", { ascending: true });

    if (finalGroupId) query = query.eq("group_id", finalGroupId);

    const { data, error } = await query.range(offset, offset + limit - 1);
    if (error) {
      return fail(reply, 500, "tasks_fetch_failed", "Failed to fetch tasks", requestId);
    }

    let withAttachments = await attachAttachments(admin, auth.tenant.id, data || []);

    if (currentStudent && withAttachments.length > 0) {
      const taskIds = withAttachments.map((t) => t.id);
      const { data: statuses } = await admin
        .from("student_task_status")
        .select("task_id, status")
        .eq("tenant_id", auth.tenant.id)
        .eq("student_id", currentStudent.id)
        .in("task_id", taskIds);
      const statusMap = new Map((statuses || []).map((s) => [s.task_id, s.status]));
      withAttachments = withAttachments.map((t) => ({ ...t, my_status: statusMap.get(t.id) || null }));
    }

    const mapped = withAttachments.map(mapTaskRow);
    return ok(reply, { items: mapped, limit, offset }, requestId);
  });

  app.post("/", async (req, reply) => {
    const requestId = req.requestId || makeRequestId();
    const tenantSlug = getTenantSlug(req);

    const auth = await requireRole(req, reply, requestId, {
      tenantSlug,
      roles: ["admin", "teacher"],
    });
    if (!auth.ok) return;

    const parsed = TaskCreateSchema.safeParse(req.body || {});
    if (!parsed.success) {
      console.error('[TASKS 400]', JSON.stringify(parsed.error.issues, null, 2));
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
    const { data, error } = await admin
      .from("tasks")
      .insert({
        tenant_id: auth.tenant.id,
        group_id: parsed.data.group_id,
        teacher_id: auth.user.id,
        type: parsed.data.type,
        title: parsed.data.title,
        description: parsed.data.desc ?? null,
        subject_name: parsed.data.subject_name || null,
        due_date: parsed.data.due_date || null,
      })
      .select("id, group_id, teacher_id, type, title, description, subject_name, due_date, created_at")
      .single();

    if (error) {
      return fail(reply, 500, "task_create_failed", "Failed to create task", requestId);
    }

    const withAttachments = await attachAttachments(admin, auth.tenant.id, [data]);
    return created(reply, mapTaskRow(withAttachments[0]), requestId);
  });

  app.patch("/", async (req, reply) => {
    const requestId = req.requestId || makeRequestId();
    const tenantSlug = getTenantSlug(req);

    const auth = await requireRole(req, reply, requestId, {
      tenantSlug,
      roles: ["admin", "teacher", "student"],
    });
    if (!auth.ok) return;

    const parsed = TaskPatchSchema.safeParse(req.body || {});
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
    const { student_id, student_status, ...taskFields } = parsed.data;

    // Students can only update their own student_status — block any other PATCH path
    if (auth.membership.role === "student") {
      if (!student_id || !student_status) {
        return fail(reply, 403, "forbidden", "Estudiantes solo pueden actualizar su propio estado.", requestId);
      }
      const stu = await getStudentForUser(admin, auth.tenant.id, auth.user.id);
      if (!stu || stu.id !== student_id) {
        return fail(reply, 403, "forbidden", "No puedes actualizar el estado de otro alumno.", requestId);
      }
    }

    if ((student_id && !student_status) || (!student_id && student_status)) {
      return fail(
        reply,
        400,
        "invalid_body",
        "student_id and student_status must be provided together",
        requestId
      );
    }

    if (student_id && student_status) {
      const { data, error } = await admin
        .from("student_task_status")
        .upsert(
          {
            tenant_id: auth.tenant.id,
            task_id: parsed.data.id,
            student_id,
            status: student_status,
          },
          { onConflict: "task_id,student_id" }
        )
        .select("id, task_id, student_id, status, updated_at")
        .single();

      if (error) {
        return fail(reply, 500, "task_status_update_failed", "Failed to update task status", requestId);
      }
      return ok(reply, data, requestId);
    }

    const updates = {
      group_id: taskFields.group_id,
      type: taskFields.type,
      title: taskFields.title,
      description: taskFields.desc ?? null,
      subject_name: taskFields.subject_name ?? null,
      due_date: taskFields.due_date,
    };

    const { data, error } = await admin
      .from("tasks")
      .update(updates)
      .eq("tenant_id", auth.tenant.id)
      .eq("id", parsed.data.id)
      .select("id, group_id, teacher_id, type, title, description, subject_name, due_date, created_at")
      .single();

    if (error) {
      return fail(reply, 500, "task_update_failed", "Failed to update task", requestId);
    }

    const withAttachments = await attachAttachments(admin, auth.tenant.id, [data]);
    return ok(reply, mapTaskRow(withAttachments[0]), requestId);
  });

  app.delete("/", async (req, reply) => {
    const requestId = req.requestId || makeRequestId();
    const tenantSlug = getTenantSlug(req);

    const auth = await requireRole(req, reply, requestId, {
      tenantSlug,
      roles: ["admin", "teacher"],
    });
    if (!auth.ok) return;

    const parsed = TaskDeleteSchema.safeParse(req.body || req.query || {});
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
    const taskId = parsed.data.id;

    await admin
      .from("student_task_status")
      .delete()
      .eq("tenant_id", auth.tenant.id)
      .eq("task_id", taskId);

    await admin
      .from("attachments")
      .delete()
      .eq("tenant_id", auth.tenant.id)
      .eq("owner_type", "task")
      .eq("owner_id", taskId);

    const { error } = await admin
      .from("tasks")
      .delete()
      .eq("tenant_id", auth.tenant.id)
      .eq("id", taskId);

    if (error) {
      return fail(reply, 500, "task_delete_failed", "Failed to delete task", requestId);
    }

    return ok(reply, { ok: true }, requestId);
  });

  app.put("/", methodNotAllowed);
  app.head("/", methodNotAllowed);
}
