import { createSupabaseAdmin } from "./supabase.js";
import { getMembership, roleAllowed } from "./auth.js";

export async function resolveTenantForUser({ userId, tenantSlug, allowedRoles = [] }) {
  if (!tenantSlug) {
    return { ok: false, status: 400, error: "tenant_slug_required" };
  }

  const admin = createSupabaseAdmin();
  const { data: tenant, error: tenantErr } = await admin
    .from("tenants")
    .select("id, slug, name")
    .eq("slug", tenantSlug)
    .maybeSingle();

  if (tenantErr) {
    return { ok: false, status: 500, error: "tenant_lookup_failed" };
  }
  if (!tenant) {
    return { ok: false, status: 404, error: "tenant_not_found" };
  }

  const { membership } = await getMembership({ userId, tenantId: tenant.id });
  if (!membership || membership.status !== "active") {
    return { ok: false, status: 403, error: "tenant_forbidden" };
  }
  if (!roleAllowed(membership.role, allowedRoles)) {
    return { ok: false, status: 403, error: "role_forbidden" };
  }

  if (membership.role === "student") {
    const { data: student, error: studentErr } = await admin
      .from("students")
      .select("id, approval_status")
      .eq("tenant_id", tenant.id)
      .eq("user_id", userId)
      .maybeSingle();
    if (studentErr) {
      return { ok: false, status: 500, error: "student_lookup_failed" };
    }
    if (!student || student.approval_status !== "approved") {
      return { ok: false, status: 403, error: "student_not_approved" };
    }
  }

  return { ok: true, tenant, membership };
}
