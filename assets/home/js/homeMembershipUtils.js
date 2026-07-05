// Funciones puras sobre objetos membership — sin DOM, sin estado propio.

export function normalizeRole(m) {
  const raw =
    m?.role ||
    m?.member_role ||
    m?.membership_role ||
    (Array.isArray(m?.roles) ? m.roles[0] : "") ||
    (Array.isArray(m?.member_roles) ? m.member_roles[0] : "");
  return String(raw || "").trim().toLowerCase();
}

export function normalizeStatus(value) {
  return String(value || "").trim().toLowerCase();
}

export function tenantSlugOf(m) {
  return String(
    m?.tenant_slug ||
    m?.tenant?.slug ||
    m?.tenantSlug ||
    m?.tenant?.tenant_slug ||
    ""
  ).trim();
}

export function tenantNameOf(m) {
  return String(m?.tenant?.name || m?.tenant_name || tenantSlugOf(m) || "").trim();
}

export function tenantTypeOf(m) {
  return String(m?.tenant?.type || m?.tenant_type || "").trim().toLowerCase();
}

export function isActiveMembership(m) {
  const status = normalizeStatus(m?.status || m?.membership_status || "");
  return !status || status === "active";
}

export function membershipsForTenant(slug, source) {
  return (source || []).filter((m) => tenantSlugOf(m) === slug);
}

export function isStudentPendingMembership(m) {
  return normalizeRole(m) === "student" && !isActiveMembership(m);
}
