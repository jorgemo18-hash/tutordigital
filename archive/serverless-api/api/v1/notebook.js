import { makeRequestId } from "./_lib/requestId.js";
import { ok, created, fail } from "./_lib/http.js";
import { rateLimit } from "./_lib/rateLimit.js";
import { requireRole } from "./_lib/middleware.js";
import { getTenantSlug } from "./_lib/tenantSlug.js";
import { createSupabaseAdmin } from "./_lib/supabase.js";
import {
  NotebookQuerySchema,
  NotebookCreateSchema,
  NotebookPatchSchema,
} from "./_lib/validators.js";

async function getStudentForUser(admin, tenantId, userId) {
  const { data } = await admin
    .from("students")
    .select("id")
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

    const parsed = NotebookQuerySchema.safeParse(req.query || {});
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
    let studentId = parsed.data.studentId;
    if (auth.membership.role === "student") {
      const student = await getStudentForUser(admin, auth.tenant.id, auth.user.id);
      if (!student) {
        return ok(res, { items: [], limit: parsed.data.limit, offset: parsed.data.offset }, requestId);
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
      return fail(res, 500, "notebook_fetch_failed", "Failed to fetch notebook", requestId);
    }

    return ok(res, { items: data || [], limit, offset }, requestId);
  }

  if (req.method === "POST") {
    const auth = await requireRole(req, res, requestId, {
      tenantSlug,
      roles: ["admin", "teacher"],
    });
    if (!auth.ok) return;

    const parsed = NotebookCreateSchema.safeParse(req.body || {});
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
      return fail(res, 500, "notebook_create_failed", "Failed to create entry", requestId);
    }

    return created(res, data, requestId);
  }

  if (req.method === "PATCH") {
    const auth = await requireRole(req, res, requestId, {
      tenantSlug,
      roles: ["admin", "teacher"],
    });
    if (!auth.ok) return;

    const parsed = NotebookPatchSchema.safeParse(req.body || {});
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
      return fail(res, 500, "notebook_update_failed", "Failed to update entry", requestId);
    }

    return ok(res, data, requestId);
  }

  return fail(res, 405, "method_not_allowed", "Method not allowed", requestId);
}
