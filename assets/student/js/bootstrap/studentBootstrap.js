import { logout } from "../../../shared/js/auth.js";
import { initStudentTenantBootstrap } from "../../bootstrap/tenantBootstrap.js";

export function applyStudentVersionTag(appVersion) {
  try {
    console.log(`📌 Tutordigital v${appVersion}`);
    const subEl = document.querySelector("header .sub");
    if (subEl && !subEl.textContent.includes(`v${appVersion}`)) {
      subEl.textContent = `${subEl.textContent} · v${appVersion}`;
    }
  } catch {}
}

export function updateTenantStatus({ getTenant, TENANT_CFG, loadActiveUser }) {
  const status = document.getElementById("tenantStatus");
  if (!status) return;
  let groupLabel = "";
  const currentUser = loadActiveUser();
  if (currentUser?.groupId) groupLabel = currentUser.groupId;
  const tenantLabel = TENANT_CFG?.name || getTenant();
  status.textContent = `Centro: ${tenantLabel} · Rol: Alumno${groupLabel ? ` · Grupo: ${groupLabel}` : ""}`;
}

export async function initStudentBootstrap() {
  const tenantBoot = initStudentTenantBootstrap();
  const {
    session,
    getTenant,
    TENANT_CFG,
    ACTIVE_USER,
    loadActiveUser,
    ensureStudentApproval,
    initThemeControls,
  } = tenantBoot;

  const canInitStudentApp = await ensureStudentApproval();
  initThemeControls();

  try {
    const homeLink = document.getElementById("homeLink");
    if (homeLink) {
      homeLink.href = "/index.html";
      homeLink.addEventListener("click", (ev) => {
        ev.preventDefault();
        window.location.href = "/index.html";
      });
    }
  } catch {}

  try {
    const logoutBtn = document.getElementById("logoutBtn");
    if (logoutBtn) {
      logoutBtn.addEventListener("click", async () => {
        await logout();
        window.location.href = "/index.html";
      });
    }
  } catch {}

  try {
    updateTenantStatus({ getTenant, TENANT_CFG, loadActiveUser });
  } catch {}

  return {
    session,
    getTenant,
    TENANT_CFG,
    ACTIVE_USER,
    loadActiveUser,
    ensureStudentApproval,
    initThemeControls,
    canInitStudentApp,
  };
}
