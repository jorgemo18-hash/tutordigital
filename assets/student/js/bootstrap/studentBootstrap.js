import { logout, apiFetch } from "../../../shared/js/auth.js";
import { initStudentTenantBootstrap } from "../../bootstrap/tenantBootstrap.js";
import { buildHeader } from "../../../shared/js/header.js";

// Marca academia_alumnos.acceso_activado la primera vez que el alumno
// entra al tutor (ver server/routes/v1/academia.alumno-acceso.routes.js) —
// no bloquea el arranque si falla, y es un no-op en el backend si ya
// estaba activado o si no es un tenant de academia sin student_id propio.
async function activarAccesoAcademia(tenantType) {
  if (tenantType !== "academia") return;
  try {
    await apiFetch("/api/v1/academia/alumno-acceso/activar", { method: "PUT" });
  } catch {
    // no crítico — se reintentará en la próxima sesión
  }
}

// Aplica la foto de fondo propia del centro (academia_config.bg_url) a la
// vista del tutor — mismo patrón que aplicarFondoPersonalizado() en
// academiaProfesor.js/academiaAdmin.js, pero aquí el fondo es un
// .bgLayer::before (pseudo-elemento, ver student-new/01-tokens-base.css),
// así que no hay un nodo DOM al que ponerle backgroundImage directo: se
// sobrescribe la variable CSS --bgLayer-image en su lugar. No bloquea el
// arranque si falla ni si el centro no subió foto propia — el valor por
// defecto de la variable ya cubre ese caso.
async function aplicarFondoAcademia(tenantType) {
  if (tenantType !== "academia") return;
  try {
    const res = await apiFetch("/api/v1/academia/branding");
    if (!res.ok) return;
    const body = await res.json().catch(() => ({}));
    const bgUrl = body?.data?.branding?.bg_url;
    if (bgUrl && /^https?:\/\//.test(bgUrl)) {
      document.documentElement.style.setProperty("--bgLayer-image", `url('${bgUrl}')`);
    }
  } catch {
    // no crítico — se queda con el fondo por defecto del CSS
  }
}

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

  // Sin await a propósito: no debe retrasar el arranque del tutor.
  if (canInitStudentApp) activarAccesoAcademia(tenantType);
  if (canInitStudentApp) aplicarFondoAcademia(tenantType);

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
