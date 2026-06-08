import { z } from "zod";
import { makeRequestId } from "../../lib/requestId.js";
import { ok, fail } from "../../lib/http.js";
import { rateLimit } from "../../lib/rateLimit.js";
import { requireRole } from "../../lib/middleware.js";
import { getTenantSlug } from "../../lib/tenantSlug.js";
import { createSupabaseAdmin } from "../../lib/supabase.js";
import { makeTenantMembershipGuard } from "../../lib/security/tenantMembershipGuard.js";

const PatchSchema = z.object({
  subject_id: z.string().uuid(),
  trimester: z.number().int().min(1).max(3),
  exam_pct: z.number().min(0).max(100),
  work_pct: z.number().min(0).max(100),
  homework_pct: z.number().min(0).max(100),
}).refine(d => Math.round((d.exam_pct + d.work_pct + d.homework_pct) * 100) === 10000, {
  message: "exam_pct + work_pct + homework_pct must equal 100",
});

const DEFAULTS = { exam_pct: 60, work_pct: 20, homework_pct: 20 };

export default async function gradeWeightsRoutes(app) {
  const guard = makeTenantMembershipGuard();

  // GET / — weights for all subjects in a group for a given trimester
  // ?group_id=X&trimester=Y (1|2|3)
  app.get("/", { preHandler: guard.preHandler }, async (req, reply) => {
    const requestId = req.requestId || makeRequestId();
    const tenantSlug = getTenantSlug(req);
    const auth = await requireRole(req, reply, requestId, { tenantSlug, roles: ["admin", "teacher"] });
    if (!auth.ok) return;

    const rl = await rateLimit(req, { limit: 60, windowSec: 60, userId: auth.user.id, tenantId: auth.tenant.id });
    if (!rl.ok) return fail(reply, 429, "rate_limited", "Too many requests", requestId);

    const groupId = String(req.query.group_id || "").trim();
    const trimester = parseInt(req.query.trimester, 10);
    if (!groupId || !trimester || trimester < 1 || trimester > 3) {
      return fail(reply, 400, "invalid_query", "group_id and trimester (1-3) are required", requestId);
    }

    const admin = createSupabaseAdmin();

    // Get teacher profile for this tenant
    const { data: tp } = await admin
      .from("teacher_profiles")
      .select("id")
      .eq("tenant_slug", auth.tenant.slug)
      .eq("user_id", auth.user.id)
      .maybeSingle();

    if (!tp) return ok(reply, [], requestId);

    // Get subjects for this group (via teacher_group_subjects or teacher_groups)
    const { data: tgs } = await admin
      .from("teacher_group_subjects")
      .select("subjects(id, name)")
      .eq("teacher_profile_id", tp.id)
      .eq("group_id", groupId);

    let subjects = (tgs || []).map(r => r.subjects).filter(s => s?.id);

    if (!subjects.length) {
      const { data: tg } = await admin
        .from("teacher_groups")
        .select("subjects(id, name)")
        .eq("teacher_profile_id", tp.id)
        .eq("group_id", groupId)
        .not("subject_id", "is", null);
      subjects = (tg || []).map(r => r.subjects).filter(s => s?.id && s?.name);
    }

    if (!subjects.length) return ok(reply, [], requestId);

    const subjectIds = subjects.map(s => s.id);

    // Fetch stored weights for these subjects + trimester
    const { data: weights } = await admin
      .from("grade_weights")
      .select("subject_id, exam_pct, work_pct, homework_pct")
      .eq("tenant_id", auth.tenant.id)
      .in("subject_id", subjectIds)
      .eq("trimester", trimester);

    const weightMap = new Map((weights || []).map(w => [w.subject_id, w]));

    // Return one entry per subject, filling defaults where no row exists
    const result = subjects.map(s => ({
      subject_id: s.id,
      subject_name: s.name,
      trimester,
      ...(weightMap.get(s.id) ? {
        exam_pct: Number(weightMap.get(s.id).exam_pct),
        work_pct: Number(weightMap.get(s.id).work_pct),
        homework_pct: Number(weightMap.get(s.id).homework_pct),
      } : DEFAULTS),
    }));

    return ok(reply, result, requestId);
  });

  // PATCH / — upsert weights for a subject + trimester
  app.patch("/", { preHandler: guard.preHandler }, async (req, reply) => {
    const requestId = req.requestId || makeRequestId();
    const tenantSlug = getTenantSlug(req);
    const auth = await requireRole(req, reply, requestId, { tenantSlug, roles: ["admin", "teacher"] });
    if (!auth.ok) return;

    const parsed = PatchSchema.safeParse(req.body);
    if (!parsed.success) return fail(reply, 400, "invalid_body", parsed.error.issues[0]?.message || "Invalid body", requestId, { issues: parsed.error.issues });

    const rl = await rateLimit(req, { limit: 30, windowSec: 60, userId: auth.user.id, tenantId: auth.tenant.id });
    if (!rl.ok) return fail(reply, 429, "rate_limited", "Too many requests", requestId);

    const { subject_id, trimester, exam_pct, work_pct, homework_pct } = parsed.data;
    const admin = createSupabaseAdmin();

    // Verify subject belongs to this tenant
    const { data: subject } = await admin
      .from("subjects")
      .select("id")
      .eq("id", subject_id)
      .eq("tenant_id", auth.tenant.id)
      .maybeSingle();

    if (!subject) return fail(reply, 404, "not_found", "Subject not found", requestId);

    const { data, error } = await admin
      .from("grade_weights")
      .upsert({
        tenant_id: auth.tenant.id,
        subject_id,
        trimester,
        exam_pct,
        work_pct,
        homework_pct,
        created_by: auth.user.id,
        updated_at: new Date().toISOString(),
      }, { onConflict: "tenant_id,subject_id,trimester" })
      .select("subject_id, trimester, exam_pct, work_pct, homework_pct")
      .single();

    if (error) return fail(reply, 500, "db_error", "Failed to save weights", requestId);
    return ok(reply, data, requestId);
  });
}
