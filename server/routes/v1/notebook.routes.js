import { z } from "zod";
import { makeRequestId } from "../../lib/requestId.js";
import { ok, created, fail } from "../../lib/http.js";
import { rateLimit } from "../../lib/rateLimit.js";
import { requireRole } from "../../lib/middleware.js";
import { getTenantSlug } from "../../lib/tenantSlug.js";
import { createSupabaseAdmin } from "../../lib/supabase.js";
import {
  NotebookQuerySchema,
  NotebookCreateSchema,
  NotebookPatchSchema,
} from "../../../api/v1/_lib/validators.js";

const SummaryQuerySchema = z.object({
  group_id: z.string().uuid(),
  from: z.string().regex(/^\\d{4}-\\d{2}-\\d{2}$/),
  to: z.string().regex(/^\\d{4}-\\d{2}-\\d{2}$/),
});

async function getStudentForUser(admin, tenantId, userId) {
  const { data } = await admin
    .from("students")
    .select("id")
    .eq("tenant_id", tenantId)
    .eq("user_id", userId)
    .maybeSingle();
  return data || null;
}

function toIsoDateStart(dateStr) {
  return `${dateStr}T00:00:00.000Z`;
}

function toIsoDateEnd(dateStr) {
  return `${dateStr}T23:59:59.999Z`;
}

function statusForSummary({ tasks_total, tasks_done, tickets_open }) {
  if (tickets_open > 0) return "necesita";
  if (tasks_total > 0 && tasks_done < tasks_total) return "pendiente";
  return "ok";
}

export default async function notebookRoutes(app) {
  const methodNotAllowed = async (req, reply) => {
    const requestId = req.requestId || makeRequestId();
    return fail(reply, 405, "method_not_allowed", "Method not allowed", requestId);
  };

  app.get("/", async (req, reply) => {
    const requestId = req.requestId || makeRequestId();
    const tenantSlug = getTenantSlug(req);

    const auth = await requireRole(req, reply, requestId, {
      tenantSlug,
      roles: ["admin", "teacher", "student"],
    });
    if (!auth.ok) return;

    const parsed = NotebookQuerySchema.safeParse(req.query || {});
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
    let studentId = parsed.data.studentId;
    if (auth.membership.role === "student") {
      const student = await getStudentForUser(admin, auth.tenant.id, auth.user.id);
      if (!student) {
        return ok(reply, { items: [], limit: parsed.data.limit, offset: parsed.data.offset }, requestId);
      }
      studentId = student.id;
    }

    const { limit, offset } = parsed.data;
    const { data, error } = await admin
      .from("grades")
      .select("id, student_id, teacher_id, title, score, date, created_at")
      .eq("tenant_id", auth.tenant.id)
      .eq("student_id", studentId)
      .order("date", { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) {
      return fail(reply, 500, "notebook_fetch_failed", "Failed to fetch notebook", requestId);
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

    const parsed = NotebookCreateSchema.safeParse(req.body || {});
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
    const { data, error } = await admin
      .from("grades")
      .insert({
        tenant_id: auth.tenant.id,
        student_id: parsed.data.student_id,
        teacher_id: auth.user.id,
        title: parsed.data.title,
        score: parsed.data.score,
        date: parsed.data.date || null,
      })
      .select("id, student_id, teacher_id, title, score, date, created_at")
      .single();

    if (error) {
      return fail(reply, 500, "notebook_create_failed", "Failed to create entry", requestId);
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

    const parsed = NotebookPatchSchema.safeParse(req.body || {});
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
    const { data, error } = await admin
      .from("grades")
      .update({
        title: parsed.data.title,
        score: parsed.data.score,
        date: parsed.data.date,
      })
      .eq("tenant_id", auth.tenant.id)
      .eq("id", parsed.data.id)
      .select("id, student_id, teacher_id, title, score, date, created_at")
      .single();

    if (error) {
      return fail(reply, 500, "notebook_update_failed", "Failed to update entry", requestId);
    }

    return ok(reply, data, requestId);
  });

  app.get("/summary", async (req, reply) => {
    const requestId = req.requestId || makeRequestId();
    const tenantSlug = getTenantSlug(req);

    const auth = await requireRole(req, reply, requestId, {
      tenantSlug,
      roles: ["admin", "teacher"],
    });
    if (!auth.ok) return;

    const parsed = SummaryQuerySchema.safeParse(req.query || {});
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
    const { group_id, from, to } = parsed.data;

    const { data: students, error: studentsErr } = await admin
      .from("students")
      .select("id, display_name")
      .eq("tenant_id", auth.tenant.id)
      .eq("group_id", group_id);
    if (studentsErr) {
      return fail(reply, 500, "notebook_summary_failed", "Failed to fetch notebook", requestId);
    }

    const { data: tasks, error: tasksErr } = await admin
      .from("tasks")
      .select("id, due_date")
      .eq("tenant_id", auth.tenant.id)
      .eq("group_id", group_id)
      .gte("due_date", from)
      .lte("due_date", to);
    if (tasksErr) {
      return fail(reply, 500, "notebook_summary_failed", "Failed to fetch notebook", requestId);
    }

    const taskIds = (tasks || []).map((t) => t.id);
    const tasksTotal = taskIds.length;

    let statusRows = [];
    if (taskIds.length) {
      const { data: statusData, error: statusErr } = await admin
        .from("student_task_status")
        .select("student_id, status")
        .eq("tenant_id", auth.tenant.id)
        .in("task_id", taskIds);
      if (statusErr) {
        return fail(reply, 500, "notebook_summary_failed", "Failed to fetch notebook", requestId);
      }
      statusRows = statusData || [];
    }

    const doneByStudent = new Map();
    statusRows.forEach((row) => {
      if (row.status !== "done") return;
      const prev = doneByStudent.get(row.student_id) || 0;
      doneByStudent.set(row.student_id, prev + 1);
    });

    const { data: tickets, error: ticketsErr } = await admin
      .from("tickets")
      .select("id, student_id, status, created_at")
      .eq("tenant_id", auth.tenant.id)
      .eq("group_id", group_id)
      .gte("created_at", toIsoDateStart(from))
      .lte("created_at", toIsoDateEnd(to));
    if (ticketsErr) {
      return fail(reply, 500, "notebook_summary_failed", "Failed to fetch notebook", requestId);
    }

    const openByStudent = new Map();
    const closedByStudent = new Map();
    (tickets || []).forEach((t) => {
      if (!t.student_id) return;
      if (t.status === "open") {
        openByStudent.set(t.student_id, (openByStudent.get(t.student_id) || 0) + 1);
      } else {
        closedByStudent.set(t.student_id, (closedByStudent.get(t.student_id) || 0) + 1);
      }
    });

    const studentsList = (students || []).map((s) => {
      const tasks_done = doneByStudent.get(s.id) || 0;
      const tickets_open = openByStudent.get(s.id) || 0;
      const tickets_closed = closedByStudent.get(s.id) || 0;
      return {
        student_id: s.id,
        name: s.display_name || "",
        tasks_total: tasksTotal,
        tasks_done,
        tickets_open,
        tickets_closed,
        status: statusForSummary({
          tasks_total: tasksTotal,
          tasks_done,
          tickets_open,
        }),
      };
    });

    return ok(reply, { group_id, from, to, students: studentsList }, requestId);
  });

  app.put("/", methodNotAllowed);
  app.delete("/", methodNotAllowed);
  app.head("/", methodNotAllowed);

  app.put("/summary", methodNotAllowed);
  app.post("/summary", methodNotAllowed);
  app.patch("/summary", methodNotAllowed);
  app.delete("/summary", methodNotAllowed);
  app.head("/summary", methodNotAllowed);
}
