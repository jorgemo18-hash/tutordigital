import { setActiveTenantSlug, getTenantSlug } from "../../shared/js/auth.js";
import { showStep } from "./homeUi.js";
import {
  normalizeRole,
  tenantSlugOf,
  tenantNameOf,
  tenantTypeOf,
  isActiveMembership,
  membershipsForTenant,
  isStudentPendingMembership,
} from "./homeMembershipUtils.js";

// Decide a qué panel enviar a un usuario según sus memberships activas en un
// tenant concreto — admin > teacher > student > alumno pendiente > join.
export function routeForTenant(dom, tenantSlug, source) {
  const scoped = membershipsForTenant(tenantSlug, source);
  const active = scoped.filter(isActiveMembership);
  const roles = active.map((m) => normalizeRole(m)).filter(Boolean);

  const hasAdmin = roles.includes("admin");
  const hasTeacher = roles.includes("teacher");
  const hasStudent = roles.includes("student");
  const isAcademia = tenantTypeOf(active[0] || scoped[0] || {}) === "academia";

  if (hasAdmin) {
    const any = active[0] || scoped[0] || null;
    if (any) setActiveTenantFromMembership(dom, any);
    try { localStorage.setItem("ttd_activeRole", "admin"); } catch {}
    window.location.href = isAcademia ? "/assets/academia/admin/index.html" : "/assets/admin/";
    return;
  }

  if (hasTeacher) {
    try {
      if (tenantSlug) localStorage.setItem("ttd_activeTenantSlug", tenantSlug);
      localStorage.setItem("ttd_activeRole", "teacher");
    } catch {}
    window.location.href = isAcademia
      ? "/assets/academia/profesor/index.html"
      : "/assets/teacher/index.html";
    return;
  }

  if (hasStudent) {
    try {
      if (tenantSlug) localStorage.setItem("ttd_activeTenantSlug", tenantSlug);
      localStorage.setItem("ttd_activeRole", "student");
    } catch {}
    // Alumno de academia va al panel de alumno real (arranca en el tutor,
    // ver meta-mode.js) — el placeholder de /assets/academia/index.html ya
    // no aplica a alumnos.
    window.location.href = "/assets/student/index.html";
    return;
  }

  const pendingStudent = scoped.find(isStudentPendingMembership);
  if (pendingStudent) {
    try {
      if (tenantSlug) localStorage.setItem("ttd_activeTenantSlug", tenantSlug);
      localStorage.setItem("ttd_activeRole", "student");
    } catch {}
    showStudentPendingStep(dom, pendingStudent);
    return;
  }

  showStep(dom, "join");
}

export function showStudentPendingStep(dom, membership) {
  const name = membership?.tenant?.name || membership?.tenant?.slug || "este centro";
  if (dom.pendingApprovalText) {
    dom.pendingApprovalText.textContent = `Tu acceso como alumno en ${name} está pendiente de aprobación por el docente/admin.`;
  }
  showStep(dom, "pending");
}

export function fillTenantSelect(dom, list = []) {
  if (!dom.tenantSelect) return;
  dom.tenantSelect.innerHTML = "";
  const seen = new Set();
  list.forEach((m) => {
    const slug = tenantSlugOf(m);
    if (!slug || seen.has(slug)) return;
    seen.add(slug);
    const opt = document.createElement("option");
    opt.value = slug;
    const name = tenantNameOf(m) || slug;
    opt.textContent = `${name} (${slug})`;
    dom.tenantSelect.appendChild(opt);
  });
}

export function setActiveTenantFromMembership(dom, m) {
  const slug = tenantSlugOf(m);
  if (!slug) return;
  setActiveTenantSlug(slug);
  if (dom.tenantName2) dom.tenantName2.textContent = tenantNameOf(m) || slug;
}

export function getSelectedTenantSlug(dom, source) {
  const fromSelect = String(dom.tenantSelect?.value || "").trim();
  if (fromSelect) return fromSelect;
  const fromStored = String(getTenantSlug() || "").trim();
  if (fromStored) return fromStored;
  const fromMembership = String(source?.[0]?.tenant?.slug || "").trim();
  if (fromMembership) return fromMembership;
  return "";
}

export function getMembershipForSelectedTenant(dom, source) {
  const slug = getSelectedTenantSlug(dom, source);
  if (!slug) return null;
  return (source || []).find((m) => tenantSlugOf(m) === slug) || null;
}

// Config de los botones "Entrar como alumno/docente" del selector de tenant
// — antes eran dos handlers casi idénticos (mismo cálculo de roles activos,
// mismo guardado en localStorage, solo cambiaba el rol comprobado, el
// destino y si aplica el paso de aprobación pendiente).
const ENTER_ROLE_CONFIG = {
  student: {
    destinationUrl: "/assets/student/index.html",
    deniedMessage: "Tu acceso en este centro no es de alumno.",
    checkPending: true,
  },
  teacher: {
    destinationUrl: "/assets/teacher/index.html",
    deniedMessage: "Tu acceso en este centro no es de docente.",
    checkPending: false,
  },
};

// `role` es "student" o "teacher". `source` son las memberships ya cargadas
// (ver homeMembershipsState.js#getMemberships).
export function enterAs(dom, source, role) {
  const config = ENTER_ROLE_CONFIG[role];
  const tenantSlug = getSelectedTenantSlug(dom, source);
  const scoped = membershipsForTenant(tenantSlug, source);
  const activeRoles = scoped.filter(isActiveMembership).map((m) => normalizeRole(m));
  const hasAdmin = activeRoles.includes("admin");
  const hasRole = activeRoles.includes(role);

  if (!hasAdmin && !hasRole) {
    try { window.alert(config.deniedMessage); } catch {}
    return;
  }

  if (config.checkPending && !hasAdmin) {
    const pendingStudent = scoped.find(isStudentPendingMembership);
    if (pendingStudent) {
      showStudentPendingStep(dom, pendingStudent);
      return;
    }
  }

  try {
    if (tenantSlug) localStorage.setItem("ttd_activeTenantSlug", tenantSlug);
    localStorage.setItem("ttd_activeRole", role);
  } catch {}
  window.location.href = config.destinationUrl;
}
