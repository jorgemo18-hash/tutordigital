import {
  apiFetch,
  getAccessToken,
  getTenantSlug,
  logout,
  setActiveTenantSlug,
} from "../shared/js/auth.js";

const tenantEl = document.getElementById("adminTenant");
const roleEl = document.getElementById("adminRole");
const emailEl = document.getElementById("adminEmail");
const errorEl = document.getElementById("adminError");

const asTeacherBtn = document.getElementById("adminAsTeacher");
const asStudentBtn = document.getElementById("adminAsStudent");
const logoutBtn = document.getElementById("adminLogout");

function setError(msg) {
  if (!errorEl) return;
  errorEl.textContent = msg || "";
  errorEl.style.display = msg ? "block" : "none";
}

function normalizeRole(m) {
  const role =
    m?.role ||
    m?.member_role ||
    m?.membership_role ||
    (Array.isArray(m?.roles) ? m.roles[0] : "") ||
    "";
  return String(role || "").toLowerCase();
}

function tenantSlugOf(m) {
  return String(
    m?.tenant_slug ||
    m?.tenant?.slug ||
    m?.tenantSlug ||
    m?.tenant?.tenant_slug ||
    ""
  ).trim();
}

function tenantNameOf(m) {
  return String(m?.tenant?.name || m?.tenant_name || tenantSlugOf(m) || "").trim();
}

function isActiveMembership(m) {
  const status = String(m?.status || m?.membership_status || "").toLowerCase();
  return !status || status === "active";
}

function goTeacher() {
  try { localStorage.setItem("ttd_activeRole", "teacher"); } catch {}
  window.location.href = "/assets/teacher/";
}

function goStudent() {
  try { localStorage.setItem("ttd_activeRole", "student"); } catch {}
  window.location.href = "/assets/student/";
}

async function init() {
  const token = getAccessToken();
  if (!token) {
    window.location.href = "/index.html";
    return;
  }

  const res = await apiFetch("/api/v1/me");
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    window.location.href = "/index.html";
    return;
  }

  const me = body?.data || body || {};
  const memberships = Array.isArray(me?.memberships) ? me.memberships : [];
  const activeMemberships = memberships.filter(isActiveMembership);

  if (!activeMemberships.length) {
    window.location.href = "/index.html";
    return;
  }

  let activeTenantSlug = String(getTenantSlug() || "").trim();
  if (!activeTenantSlug) {
    activeTenantSlug = tenantSlugOf(activeMemberships[0]) || "";
    if (activeTenantSlug) setActiveTenantSlug(activeTenantSlug);
  }

  let scoped = activeMemberships.filter((m) => tenantSlugOf(m) === activeTenantSlug);
  if (!scoped.length) {
    scoped = activeMemberships;
    activeTenantSlug = tenantSlugOf(scoped[0]) || activeTenantSlug;
    if (activeTenantSlug) setActiveTenantSlug(activeTenantSlug);
  }

  const roles = scoped.map(normalizeRole).filter(Boolean);
  const hasAdmin = roles.includes("admin");
  const hasTeacher = roles.includes("teacher");
  const hasStudent = roles.includes("student");

  if (!hasAdmin) {
    if (hasTeacher) {
      goTeacher();
      return;
    }
    if (hasStudent) {
      goStudent();
      return;
    }
    window.location.href = "/index.html";
    return;
  }

  if (tenantEl) tenantEl.textContent = tenantNameOf(scoped[0]) || activeTenantSlug || "—";
  if (roleEl) roleEl.textContent = "admin";
  if (emailEl) emailEl.textContent = me?.user?.email || "—";

  asTeacherBtn?.addEventListener("click", goTeacher);
  asStudentBtn?.addEventListener("click", goStudent);
  logoutBtn?.addEventListener("click", async () => {
    await logout();
    window.location.href = "/index.html";
  });
}

init().catch((err) => {
  setError(err?.message || "No se pudo cargar la zona admin.");
});
