import { logout } from "../../../shared/js/auth.js";
import { initStudentTenantBootstrap } from "../../bootstrap/tenantBootstrap.js";
import { buildHeader } from "../../../shared/js/header.js";

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
  const nameTag = document.getElementById("studentNameTag");
  const currentUser = loadActiveUser();

  if (nameTag) {
    const displayName = currentUser?.displayName || "";
    nameTag.textContent = displayName ? `Alumno · ${displayName}` : "Modo alumno";
  }

  if (!status) return;
  const groupLabel = currentUser?.groupName || currentUser?.groupId || "";
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
  // Leído después del await: tenantBoot.tenantType es un getter sobre
  // session.tenantType, que ensureStudentApproval() recién ha rellenado.
  const tenantType = tenantBoot.tenantType;
  initThemeControls();

  try {
    buildHeader(document.getElementById("headerNav"), {
      role: "student",
      btnClass: "themeToggle",
      onLogout: async () => { await logout(); window.location.href = "/login"; },
    });
  } catch {}

  try {
    updateTenantStatus({ getTenant, TENANT_CFG, loadActiveUser });
  } catch {}

  return {
    session,
    getTenant,
    tenantType,
    TENANT_CFG,
    ACTIVE_USER,
    loadActiveUser,
    ensureStudentApproval,
    initThemeControls,
    canInitStudentApp,
  };
}
