const ROLE_URLS = {
  admin: "/assets/admin/",
  teacher: "/assets/teacher/",
  student: "/assets/student/",
};

const ROLE_LABELS = {
  admin: "Admin",
  teacher: "Profesor",
  student: "Alumno",
};

/**
 * Renders role-switching buttons into `container`.
 * Shows only roles the user has in the current tenant, excluding currentRole.
 *
 * @param {HTMLElement|null} container
 * @param {{ memberships: object[], tenantSlug: string, currentRole: string, btnClass?: string }} opts
 */
export function buildRoleNavButtons(container, { memberships, tenantSlug, currentRole, btnClass = "" }) {
  if (!container || !Array.isArray(memberships)) return;

  const tenantRoles = Array.from(new Set(
    memberships
      .filter(m => (m?.tenant?.slug || m?.tenant_slug || m?.tenantSlug || "") === tenantSlug)
      .map(m => (m?.role || m?.membership_role || "").toLowerCase())
      .filter(r => r && ROLE_URLS[r] && r !== currentRole)
  ));

  container.innerHTML = "";
  tenantRoles.forEach(role => {
    const btn = document.createElement("button");
    btn.type = "button";
    if (btnClass) btn.className = btnClass;
    btn.textContent = ROLE_LABELS[role] || role;
    btn.addEventListener("click", () => {
      try { localStorage.setItem("ttd_activeRole", role); } catch {}
      window.location.href = ROLE_URLS[role];
    });
    container.appendChild(btn);
  });
}
