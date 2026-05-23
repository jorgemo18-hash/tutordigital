import { z } from "zod";
import { makeRequestId } from "../../lib/requestId.js";
import { ok, fail } from "../../lib/http.js";
import { requireRole } from "../../lib/middleware.js";
import { getTenantSlug } from "../../lib/tenantSlug.js";
import { createSupabaseAdmin } from "../../lib/supabase.js";
import { makeTenantMembershipGuard } from "../../lib/security/tenantMembershipGuard.js";

const QuerySchema = z.object({
  group_id: z.string().uuid(),
});

export default async function subjectsRoutes(app) {
  const guard = makeTenantMembershipGuard();

  app.get("/", { preHandler: guard.preHandler }, async (req, reply) => {
    const requestId = req.requestId || makeRequestId();
    const tenantSlug = getTenantSlug(req);
    const auth = await requireRole(req, reply, requestId, { tenantSlug, roles: ["admin", "teacher"] });
    if (!auth.ok) return;

    const parsed = QuerySchema.safeParse(req.query);
    if (!parsed.success) return fail(reply, 400, "invalid_query", "group_id required", requestId);

    const { group_id } = parsed.data;
    const admin = createSupabaseAdmin();

    const { data: tp } = await admin
      .from("teacher_profiles")
      .select("id")
      .eq("tenant_slug", auth.tenant.slug)
      .eq("user_id", auth.user.id)
      .maybeSingle();

    if (!tp) return ok(reply, [], requestId);

    // Prefer teacher_group_subjects (more granular) if populated
    const { data: tgs } = await admin
      .from("teacher_group_subjects")
      .select("subjects(id, name)")
      .eq("teacher_profile_id", tp.id)
      .eq("group_id", group_id);

    if (tgs?.length) {
      const subjects = tgs.map(r => r.subjects).filter(s => s?.id);
      return ok(reply, subjects, requestId);
    }

    // Fall back to teacher_groups.subject_id
    const { data: tg } = await admin
      .from("teacher_groups")
      .select("subjects(id, name)")
      .eq("teacher_profile_id", tp.id)
      .eq("group_id", group_id)
      .not("subject_id", "is", null);

    const subjects = (tg || []).map(r => r.subjects).filter(s => s?.id && s?.name);
    return ok(reply, subjects, requestId);
  });
}
