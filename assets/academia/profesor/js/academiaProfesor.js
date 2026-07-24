import { requireSessionOrRedirect } from "../../../shared/js/guard.js";
import { logout } from "../../../shared/js/auth.js";
import { getTheme, saveTheme } from "../../../shared/js/header.js";
import { fetchMe, fetchConfig } from "./api.js";
import { TABS, buildHeader } from "./tabsHeader.js";
import { createFicharBanner } from "./banner/ficharBanner.js";

function temaClase(theme) {
  return theme === "light" ? "ac-claro" : "ac-oscuro";
}

function buildFrame(stage) {
  stage.innerHTML = "";
  const frame = document.createElement("div");
  frame.className = `ac-frame bg-frame ${temaClase(getTheme())}`;
  stage.appendChild(frame);

  // La pila de fondo (bg-photo/bg-veil) es la compartida de
  // assets/shared/styles/components/bg-layers.css — .ac-photo/.ac-veil
  // solo quedan para la imagen concreta y el ajuste de posición dentro
  // de .ac-frame (ver _academia-profesor.css).
  const photo = document.createElement("div");
  photo.className = "ac-photo bg-photo";
  const veil = document.createElement("div");
  veil.className = "ac-veil bg-veil";
  frame.append(photo, veil);

  const shell = document.createElement("div");
  shell.className = "ac-shell";
  frame.appendChild(shell);

  return { frame, shell, photo };
}

// Mismo mecanismo que el panel admin (academiaAdmin.js): si el tenant
// subió su propia foto de fondo, sustituye la imagen por defecto del CSS.
function aplicarFondoPersonalizado(photo, bgUrl) {
  if (bgUrl) photo.style.backgroundImage = `url('${bgUrl}')`;
}

async function init() {
  requireSessionOrRedirect({ requireTenant: true });

  const stage = document.getElementById("academiaProfesorApp");
  const { frame, shell, photo } = buildFrame(stage);

  let me = { displayName: "", role: "", tenantName: "" };
  try {
    me = await fetchMe();
  } catch {
    // si falla, seguimos con cabecera vacía en vez de bloquear el panel
  }
  if (me.role === "student") {
    window.location.href = "/login";
    return;
  }

  const config = await fetchConfig().catch(() => null);
  aplicarFondoPersonalizado(photo, config?.bg_url);

  const tabs = TABS;
  let activeTabId = tabs[0].id;

  // El banner ("Aún no has fichado hoy") y el widget de la cabecera son
  // dos componentes que fichan la misma entrada/salida del trabajador:
  // el banner solo cubre entrada, y la salida solo se puede fichar desde
  // el widget. `banner` empieza en null porque el widget (creado dentro
  // de buildHeader, más abajo) necesita su propio `onFichado` ANTES de
  // que el banner exista — para cuando de verdad se dispare (tras un
  // clic real), la asignación de más abajo ya se habrá hecho.
  let banner = null;
  const { header: headerEl, tabButtons, setThemeBtnLabel, ficharWidgetRefrescar } = buildHeader(shell, {
    who: me.displayName || "Profesor",
    academia: me.tenantName || "Academia",
    tabsList: tabs,
    controlHorarioActivo: Boolean(config?.control_horario_activo),
    ficharWidgetDeps: { onFichado: () => banner?.refresh() },
    onTabSelect: selectTab,
    onThemeToggle: () => {
      const next = getTheme() === "light" ? "dark" : "light";
      saveTheme(next);
      frame.className = `ac-frame ${temaClase(next)}`;
      setThemeBtnLabel(next);
    },
    onLogout: async () => {
      await logout();
      window.location.href = "/login";
    },
  });
  shell.appendChild(headerEl);

  // Fila propia del grid (ver .ac-shell.con-fichar-banner) para que
  // ningún cambio de tab lo toque — no vive dentro de .ac-body. Solo se
  // monta si el tenant activó el control horario; sin eso, ni siquiera
  // se crea (nada que fichar).
  if (config?.control_horario_activo) {
    shell.classList.add("con-fichar-banner");
    banner = createFicharBanner({ onFichado: () => ficharWidgetRefrescar?.() });
    shell.appendChild(banner.el);
  }

  const body = document.createElement("div");
  body.className = "ac-body";
  shell.appendChild(body);

  function selectTab(tabId) {
    activeTabId = tabId;
    for (const [id, btn] of tabButtons) btn.classList.toggle("active", id === tabId);
    const tab = tabs.find((t) => t.id === tabId);
    tab.render(body);
  }

  setThemeBtnLabel(getTheme());
  selectTab(activeTabId);
}

init();
