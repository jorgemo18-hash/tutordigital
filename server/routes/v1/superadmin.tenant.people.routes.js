import { ok, fail } from "../../lib/http.js";
import { requireSuperAdmin } from "../../lib/superadminGuard.js";
import { fetchTeacherProfiles, fetchTeacherSubjects } from "../../lib/adminTeacherQueries.js";

async function findTenantBySlug(admin, slug) {
  const { data } = await admin
    .from("tenants").select("id, slug").eq("slug", slug).is("deleted_at", null).maybeSingle();
  return data || null;
}

export default async function superadminTenantPeopleRoutes(app) {

  // GET /api/v1/superadmin/tenants/:slug/students — últimos 5 alumnos del centro
  app.get("/superadmin/tenants/:slug/students", async (req, reply) => {
    const ctx = await requireSuperAdmin(req, reply);
    if (!ctx) return;
    const { admin, requestId } = ctx;
    const { slug } = req.params;

    const tenant = await findTenantBySlug(admin, slug);
    if (!tenant) return fail(reply, 404, "tenant_not_found", "Centro no encontrado", requestId);

    const { data, error } = await admin
      .from("students")
      .select("id, display_name, first_name, last_name, created_at, approval_status, group_id")
      .eq("tenant_id", tenant.id)
      .order("created_at", { ascending: false })
      .limit(5);

    if (error) {
      req.log.error({ requestId, err: error }, "superadmin tenant students query failed");
      return fail(reply, 500, "students_fetch_failed", "No se pudieron obtener los alumnos", requestId);
    }

    return ok(reply, { items: data || [] }, requestId);
  });

  // GET /api/v1/superadmin/tenants/:slug/teachers — docentes del centro
  app.get("/superadmin/tenants/:slug/teachers", async (req, reply) => {
    const ctx = await requireSuperAdmin(req, reply);
    if (!ctx) return;
    const { admin, requestId } = ctx;
    const { slug } = req.params;

    const tenant = await findTenantBySlug(admin, slug);
    if (!tenant) return fail(reply, 404, "tenant_not_found", "Centro no encontrado", requestId);

    const { rows, error } = await fetchTeacherProfiles(admin, tenant);
    if (error) {
      req.log.error({ requestId, err: error }, "superadmin tenant teachers query failed");
      return fail(reply, 500, "teachers_fetch_failed", "No se pudieron obtener los docentes", requestId);
    }

    const profiles = rows || [];
    const subjectCountByTeacher = new Map();
    if (profiles.length) {
      const { rows: subjectRows } = await fetchTeacherSubjects(admin, profiles.map(p => p.id));
      for (const row of subjectRows || []) {
        const subjectId = row.subject?.id;
        if (!subjectId) continue;
        const set = subjectCountByTeacher.get(row.teacher_profile_id) || new Set();
        set.add(subjectId);
        subjectCountByTeacher.set(row.teacher_profile_id, set);
      }
    }

    const items = profiles.map(p => ({
      id: p.id,
      display_name: p.display_name || null,
      email: p.email || null,
      is_active: p.is_active === true,
      created_at: p.created_at || null,
      num_subjects: subjectCountByTeacher.get(p.id)?.size || 0,
    }));

    return ok(reply, { items }, requestId);
  });
}
