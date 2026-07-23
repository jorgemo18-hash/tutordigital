import {
  isSchemaError,
  isRecoverableSchemaError,
  isInviteActiveRow,
  uniq,
} from "./adminTeacherHelpers.js";

// ── DB queries ─────────────────────────────────────────────────────────────

export async function ensureGroupsBelongToTenant(admin, tenantId, groupIds) {
  if (!groupIds.length) return { ok: true, groups: [] };
  const { data, error } = await admin
    .from("groups")
    .select("id")
    .eq("tenant_id", tenantId)
    .in("id", groupIds);

  if (error) return { ok: false, reason: "groups_lookup_failed" };
  const found = new Set((data || []).map((row) => row.id));
  const missing = groupIds.filter((id) => !found.has(id));
  if (missing.length) return { ok: false, reason: "invalid_group_ids", missing };
  return { ok: true, groups: data || [] };
}

export async function findExistingActiveTeacherInvite(admin, { tenantId, tenantSlug, emailNorm }) {
  const attempts = [
    { filterKey: "tenant_id", filterValue: tenantId },
    { filterKey: "tenant_slug", filterValue: tenantSlug },
  ];

  for (const attempt of attempts) {
    const { data, error } = await admin
      .from("teacher_invites")
      .select("id, email, status, created_at, expires_at, used_at, revoked_at")
      .eq(attempt.filterKey, attempt.filterValue)
      .ilike("email", emailNorm)
      .order("created_at", { ascending: false })
      .limit(20);
    if (error) continue;
    const existing = (data || []).find(isInviteActiveRow) || null;
    if (existing) return existing;
  }
  return null;
}

export async function revokeTeacherInvitesFallback(admin, { tenantId, tenantSlug, email }) {
  let q = admin
    .from("teacher_invites")
    .update({ status: "revoked", revoked_at: new Date().toISOString() })
    .eq("tenant_id", tenantId)
    .eq("email", email)
    .eq("status", "pending");
  let { error } = await q;
  if (error && isRecoverableSchemaError(error)) {
    q = admin
      .from("teacher_invites")
      .update({ status: "revoked", revoked_at: new Date().toISOString() })
      .eq("tenant_slug", tenantSlug)
      .eq("email", email)
      .eq("status", "pending");
    ({ error } = await q);
  }
  if (error && !isRecoverableSchemaError(error)) throw error;
}

export async function fetchTeacherProfiles(admin, tenant) {
  const attempts = [
    // nif_dni/fecha_alta (migración 095) y telefono/direccion (migración
    // 094) van en los dos primeros intentos, cada uno cayendo al
    // siguiente si esa migración concreta no se ha corrido todavía en
    // este entorno — el resto de la cadena se deja intacta como último
    // fallback.
    { select: "id, email, display_name, is_active, user_id, created_at, telefono, direccion, nif_dni, fecha_alta", filterKey: "tenant_slug", filterValue: tenant.slug, order: true },
    { select: "id, email, display_name, is_active, user_id, created_at, telefono, direccion", filterKey: "tenant_slug", filterValue: tenant.slug, order: true },
    { select: "id, email, display_name, is_active, user_id, created_at", filterKey: "tenant_slug", filterValue: tenant.slug, order: true },
    { select: "id, email, display_name, is_active, created_at", filterKey: "tenant_slug", filterValue: tenant.slug, order: true },
    { select: "id, email, display_name, is_active, user_id", filterKey: "tenant_slug", filterValue: tenant.slug, order: false },
    { select: "id, email, display_name, is_active", filterKey: "tenant_slug", filterValue: tenant.slug, order: false },
    { select: "id, email, display_name, is_active, user_id, created_at", filterKey: "tenant_id", filterValue: tenant.id, order: true },
    { select: "id, email, display_name, is_active, created_at", filterKey: "tenant_id", filterValue: tenant.id, order: true },
    { select: "id, email, display_name, is_active, user_id", filterKey: "tenant_id", filterValue: tenant.id, order: false },
    { select: "id, email, display_name, is_active", filterKey: "tenant_id", filterValue: tenant.id, order: false },
  ];

  let lastError = null;
  let usedAttempt = null;
  for (const attempt of attempts) {
    let query = admin.from("teacher_profiles").select(attempt.select).eq(attempt.filterKey, attempt.filterValue);
    if (attempt.order) query = query.order("created_at", { ascending: false });
    const { data, error } = await query;
    if (!error) {
      const rows = (data || []).map((row) => ({ ...row, user_id: row.user_id || null }));
      return { rows, attempt };
    }
    lastError = error;
    usedAttempt = attempt;
    if (!isSchemaError(error)) break;
  }
  return { rows: null, error: lastError, attempt: usedAttempt };
}

export async function fetchTeacherSubjects(admin, profileIds = []) {
  if (!profileIds.length) return { rows: [] };
  const { data, error } = await admin
    .from("teacher_subjects")
    .select("teacher_profile_id, subject:subjects(id, name)")
    .in("teacher_profile_id", profileIds);
  if (!error) return { rows: data || [] };
  if (!isSchemaError(error)) return { rows: null, error };

  const { data: flatRows, error: flatErr } = await admin
    .from("teacher_subjects")
    .select("teacher_profile_id, subject_id")
    .in("teacher_profile_id", profileIds);
  if (flatErr) return { rows: null, error: flatErr };

  const subjectIds = uniq((flatRows || []).map((r) => r.subject_id).filter(Boolean));
  let subjectsById = new Map();
  if (subjectIds.length) {
    const { data: subjects, error: subjectErr } = await admin
      .from("subjects")
      .select("id, name")
      .in("id", subjectIds);
    if (subjectErr) return { rows: null, error: subjectErr };
    subjectsById = new Map((subjects || []).map((s) => [s.id, s]));
  }

  return {
    rows: (flatRows || []).map((r) => ({
      teacher_profile_id: r.teacher_profile_id,
      subject: subjectsById.get(r.subject_id) || null,
    })),
  };
}

export async function fetchTeacherGroupSubjects(admin, profileIds = []) {
  if (!profileIds.length) return { rows: [] };
  const { data, error } = await admin
    .from("teacher_group_subjects")
    .select("teacher_profile_id, group_id, subject:subjects(id, name)")
    .in("teacher_profile_id", profileIds);
  if (!error) return { rows: data || [] };
  return { rows: [] };
}

export async function fetchTeacherGroups(admin, profileIds = []) {
  if (!profileIds.length) return { rows: [] };
  const { data, error } = await admin
    .from("teacher_groups")
    .select("teacher_profile_id, is_tutor, group:groups(id, name, level)")
    .in("teacher_profile_id", profileIds);
  if (!error) return { rows: data || [] };
  if (!isSchemaError(error)) return { rows: null, error };

  const { data: flatRows, error: flatErr } = await admin
    .from("teacher_groups")
    .select("teacher_profile_id, is_tutor, group_id")
    .in("teacher_profile_id", profileIds);
  if (flatErr) return { rows: null, error: flatErr };

  const groupIds = uniq((flatRows || []).map((r) => r.group_id).filter(Boolean));
  let groupsById = new Map();
  if (groupIds.length) {
    const { data: groups, error: groupErr } = await admin
      .from("groups")
      .select("id, name, level")
      .in("id", groupIds);
    if (groupErr) return { rows: null, error: groupErr };
    groupsById = new Map((groups || []).map((g) => [g.id, g]));
  }

  return {
    rows: (flatRows || []).map((r) => ({
      teacher_profile_id: r.teacher_profile_id,
      is_tutor: Boolean(r.is_tutor),
      group: groupsById.get(r.group_id) || null,
    })),
  };
}
