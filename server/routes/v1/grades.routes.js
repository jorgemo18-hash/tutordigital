import { z } from "zod";
import { makeRequestId } from "../../lib/requestId.js";
import { ok, created, fail } from "../../lib/http.js";
import { rateLimit } from "../../lib/rateLimit.js";
import { requireRole } from "../../lib/middleware.js";
import { getTenantSlug } from "../../lib/tenantSlug.js";
import { createSupabaseAdmin } from "../../lib/supabase.js";
import { makeTenantMembershipGuard } from "../../lib/security/tenantMembershipGuard.js";

const BulkGradeSchema = z.object({
  task_id: z.string().uuid(),
  grades: z.array(z.object({
    student_id: z.string().uuid(),
    score: z.string().max(50),
  })).min(1).max(500),
});

const PostGradeSchema = z.object({
  task_id: z.string().uuid().optional(),
  student_id: z.string().uuid(),
  title: z.string().min(1).max(200),
  score: z.string().min(1).max(50),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

const PatchGradeSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  score: z.string().min(1).max(50).optional(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
});

export default async function gradesRoutes(app) {
  const guard = makeTenantMembershipGuard();

  // GET / — by task_id OR by group_id+from+to
  app.get("/", { preHandler: guard.preHandler }, async (req, reply) => {
    const requestId = req.requestId || makeRequestId();
    const tenantSlug = getTenantSlug(req);
    const auth = await requireRole(req, reply, requestId, { tenantSlug, roles: ["admin", "teacher"] });
    if (!auth.ok) return;

    const rl = await rateLimit(req, { limit: 60, windowSec: 60, userId: auth.user.id, tenantId: auth.tenant.id });
    if (!rl.ok) return fail(reply, 429, "rate_limited", "Too many requests", requestId);

    const admin = createSupabaseAdmin();

    if (req.query.task_id) {
      const taskId = String(req.query.task_id || "").trim();
      if (!/^[0-9a-f-]{36}$/i.test(taskId)) return fail(reply, 400, "invalid_query", "Invalid task_id", requestId);

      const { data, error } = await admin
        .from("grades")
        .select("id, student_id, teacher_id, task_id, title, score, date, created_at")
        .eq("tenant_id", auth.tenant.id)
        .eq("task_id", taskId)
        .order("date", { ascending: false });

      if (error) return fail(reply, 500, "db_error", "Failed to fetch grades", requestId);
      return ok(reply, data || [], requestId);
    }

    const groupId = String(req.query.group_id || "").trim();
    const from = String(req.query.from || "").trim();
    const to = String(req.query.to || "").trim();
    if (!groupId || !from || !to) return fail(reply, 400, "invalid_query", "group_id, from and to are required", requestId);

    const { data: students } = await admin
      .from("students")
      .select("id")
      .eq("tenant_id", auth.tenant.id)
      .eq("group_id", groupId);

    if (!students?.length) return ok(reply, [], requestId);

    const studentIds = students.map(s => s.id);
    const { data, error } = await admin
      .from("grades")
      .select("id, student_id, teacher_id, task_id, title, score, date, created_at")
      .eq("tenant_id", auth.tenant.id)
      .in("student_id", studentIds)
      .gte("date", from)
      .lte("date", to)
      .order("date", { ascending: false });

    if (error) return fail(reply, 500, "db_error", "Failed to fetch grades", requestId);
    return ok(reply, data || [], requestId);
  });

  // POST / — create grade
  app.post("/", { preHandler: guard.preHandler }, async (req, reply) => {
    const requestId = req.requestId || makeRequestId();
    const tenantSlug = getTenantSlug(req);
    const auth = await requireRole(req, reply, requestId, { tenantSlug, roles: ["admin", "teacher"] });
    if (!auth.ok) return;

    const parsed = PostGradeSchema.safeParse(req.body);
    if (!parsed.success) return fail(reply, 400, "invalid_body", "Invalid body", requestId, { issues: parsed.error.issues });

    const rl = await rateLimit(req, { limit: 60, windowSec: 60, userId: auth.user.id, tenantId: auth.tenant.id });
    if (!rl.ok) return fail(reply, 429, "rate_limited", "Too many requests", requestId);

    const admin = createSupabaseAdmin();

    const { data: student } = await admin
      .from("students")
      .select("id")
      .eq("tenant_id", auth.tenant.id)
      .eq("id", parsed.data.student_id)
      .maybeSingle();

    if (!student) return fail(reply, 404, "not_found", "Student not found", requestId);

    const { data, error } = await admin
      .from("grades")
      .insert({
        tenant_id: auth.tenant.id,
        teacher_id: auth.user.id,
        student_id: parsed.data.student_id,
        task_id: parsed.data.task_id || null,
        title: parsed.data.title,
        score: parsed.data.score,
        date: parsed.data.date,
      })
      .select("id, student_id, teacher_id, task_id, title, score, date, created_at")
      .single();

    if (error) return fail(reply, 500, "db_error", "Failed to save grade", requestId);
    return created(reply, data, requestId);
  });

  // PATCH /:id — update grade
  app.patch("/:id", { preHandler: guard.preHandler }, async (req, reply) => {
    const requestId = req.requestId || makeRequestId();
    const tenantSlug = getTenantSlug(req);
    const auth = await requireRole(req, reply, requestId, { tenantSlug, roles: ["admin", "teacher"] });
    if (!auth.ok) return;

    const gradeId = String(req.params.id || "").trim();
    if (!gradeId) return fail(reply, 400, "invalid_param", "Missing id", requestId);

    const parsed = PatchGradeSchema.safeParse(req.body);
    if (!parsed.success) return fail(reply, 400, "invalid_body", "Invalid body", requestId, { issues: parsed.error.issues });

    const updates = {};
    if (parsed.data.title !== undefined) updates.title = parsed.data.title;
    if (parsed.data.score !== undefined) updates.score = parsed.data.score;
    if (parsed.data.date !== undefined) updates.date = parsed.data.date;
    if (!Object.keys(updates).length) return fail(reply, 400, "no_updates", "Nothing to update", requestId);

    const rl = await rateLimit(req, { limit: 60, windowSec: 60, userId: auth.user.id, tenantId: auth.tenant.id });
    if (!rl.ok) return fail(reply, 429, "rate_limited", "Too many requests", requestId);

    const admin = createSupabaseAdmin();
    const { data, error } = await admin
      .from("grades")
      .update(updates)
      .eq("id", gradeId)
      .eq("tenant_id", auth.tenant.id)
      .select("id, student_id, teacher_id, task_id, title, score, date, created_at")
      .single();

    if (error) return fail(reply, 500, "db_error", "Failed to update grade", requestId);
    if (!data) return fail(reply, 404, "not_found", "Grade not found", requestId);
    return ok(reply, data, requestId);
  });

  // PATCH /bulk — upsert grades for all students in a task
  app.patch("/bulk", { preHandler: guard.preHandler }, async (req, reply) => {
    const requestId = req.requestId || makeRequestId();
    const tenantSlug = getTenantSlug(req);
    const auth = await requireRole(req, reply, requestId, { tenantSlug, roles: ["admin", "teacher"] });
    if (!auth.ok) return;

    const parsed = BulkGradeSchema.safeParse(req.body);
    if (!parsed.success) return fail(reply, 400, "invalid_body", "Invalid body", requestId, { issues: parsed.error.issues });

    const rl = await rateLimit(req, { limit: 30, windowSec: 60, userId: auth.user.id, tenantId: auth.tenant.id });
    if (!rl.ok) return fail(reply, 429, "rate_limited", "Too many requests", requestId);

    const admin = createSupabaseAdmin();
    const { task_id, grades } = parsed.data;

    // Verify task belongs to tenant
    const { data: task } = await admin
      .from("tasks")
      .select("id, title")
      .eq("tenant_id", auth.tenant.id)
      .eq("id", task_id)
      .maybeSingle();

    if (!task) return fail(reply, 404, "not_found", "Task not found", requestId);

    const today = new Date().toISOString().slice(0, 10);
    const nonEmpty = grades.filter(g => g.score.trim() !== "");
    if (!nonEmpty.length) return ok(reply, { saved: 0 }, requestId);

    // For each entry: check if grade exists, then update or insert
    let saved = 0;
    for (const entry of nonEmpty) {
      const { data: existing } = await admin
        .from("grades")
        .select("id")
        .eq("tenant_id", auth.tenant.id)
        .eq("task_id", task_id)
        .eq("student_id", entry.student_id)
        .maybeSingle();

      if (existing) {
        const { error } = await admin
          .from("grades")
          .update({ score: entry.score.trim() })
          .eq("id", existing.id)
          .eq("tenant_id", auth.tenant.id);
        if (!error) saved++;
      } else {
        const { error } = await admin
          .from("grades")
          .insert({
            tenant_id: auth.tenant.id,
            teacher_id: auth.user.id,
            student_id: entry.student_id,
            task_id,
            title: task.title,
            score: entry.score.trim(),
            date: today,
          });
        if (!error) saved++;
      }
    }

    return ok(reply, { saved }, requestId);
  });

  // DELETE /:id — remove grade
  app.delete("/:id", { preHandler: guard.preHandler }, async (req, reply) => {
    const requestId = req.requestId || makeRequestId();
    const tenantSlug = getTenantSlug(req);
    const auth = await requireRole(req, reply, requestId, { tenantSlug, roles: ["admin", "teacher"] });
    if (!auth.ok) return;

    const gradeId = String(req.params.id || "").trim();
    if (!gradeId) return fail(reply, 400, "invalid_param", "Missing id", requestId);

    const rl = await rateLimit(req, { limit: 30, windowSec: 60, userId: auth.user.id, tenantId: auth.tenant.id });
    if (!rl.ok) return fail(reply, 429, "rate_limited", "Too many requests", requestId);

    const admin = createSupabaseAdmin();
    const { error } = await admin
      .from("grades")
      .delete()
      .eq("id", gradeId)
      .eq("tenant_id", auth.tenant.id);

    if (error) return fail(reply, 500, "db_error", "Failed to delete grade", requestId);
    return ok(reply, { ok: true }, requestId);
  });
}
