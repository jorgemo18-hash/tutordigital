import { buildIcon } from "./icons.js";
import { renderHorario } from "./horario.js";
import { renderDiario } from "./diario.js";
import { renderFichar } from "./fichar.js";

// Aparte de academiaProfesor.js a propósito: ese archivo hace
// `init()` incondicional al final (efecto secundario en el propio
// import, pensado para cargarse directo desde el HTML) — importarlo
// en un test dispara ese init() de verdad y revienta buscando
// #academiaProfesorApp. Este módulo no tiene ningún efecto secundario
// al importarse, así que sí es seguro testearlo directo.
export const TABS_BASE = [
  { id: "horario", label: "Horario", icon: "cal", render: renderHorario },
  { id: "diario", label: "Diario", icon: "book", render: renderDiario },
];
// Va primera (ver computeTabs) y con estilo permanente destacado (ver
// buildHeader): es la acción de uso diario más frecuente del profesor,
// no una pestaña más entre otras.
export const TAB_FICHAR = { id: "fichar", label: "Fichar", icon: "clock", render: renderFichar, destacado: true };

// "Fichar" solo aparece si el centro activó el control horario (Ajustes ›
// Personal, ver personalTab.js) — oculto por defecto para academias que
// no lo necesitan. Cuando está activo va PRIMERA (antes de Horario/
// Diario): al ser tabs[0] también queda como pestaña por defecto al
// entrar al panel.
export function computeTabs(controlHorarioActivo) {
  return controlHorarioActivo ? [TAB_FICHAR, ...TABS_BASE] : TABS_BASE;
}

export function buildHeader(shell, { who, academia, tabsList, onTabSelect, onThemeToggle, onLogout }) {
  const header = document.createElement("header");
  header.className = "ac-header";

  const brand = document.createElement("div");
  brand.className = "ac-brand";
  const logo = document.createElement("div");
  logo.className = "ac-brand-logo";
  const brandText = document.createElement("div");
  const brandName = document.createElement("span");
  brandName.className = "ac-brand-name";
  brandName.textContent = "Tutordigital";
  const brandTag = document.createElement("span");
  brandTag.className = "ac-brand-tag";
  brandTag.textContent = "Academia";
  brandText.append(brandName, brandTag);
  brand.append(logo, brandText);
  header.appendChild(brand);

  const center = document.createElement("div");
  center.className = "ac-h-center";
  const id = document.createElement("div");
  id.className = "ac-h-id";
  const whoEl = document.createElement("span");
  whoEl.className = "who";
  whoEl.textContent = who;
  const sep = document.createElement("span");
  sep.className = "sep";
  const acadEl = document.createElement("span");
  acadEl.className = "acad";
  acadEl.textContent = academia;
  id.append(whoEl, sep, acadEl);
  center.appendChild(id);

  const tabs = document.createElement("div");
  tabs.className = "ac-tabs";
  const tabButtons = new Map();
  for (const tab of tabsList) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = tab.destacado ? "ac-tab destacado" : "ac-tab";
    btn.appendChild(buildIcon(tab.icon, { size: 15 }));
    btn.appendChild(document.createTextNode(tab.label));
    btn.addEventListener("click", () => onTabSelect(tab.id));
    tabs.appendChild(btn);
    tabButtons.set(tab.id, btn);
  }
  center.appendChild(tabs);
  header.appendChild(center);

  const actions = document.createElement("div");
  actions.className = "ac-h-actions";

  const themeBtn = document.createElement("button");
  themeBtn.type = "button";
  themeBtn.className = "ac-pill";
  actions.appendChild(themeBtn);
  themeBtn.addEventListener("click", onThemeToggle);

  const logoutBtn = document.createElement("button");
  logoutBtn.type = "button";
  logoutBtn.className = "ac-pill";
  logoutBtn.appendChild(buildIcon("logout", { size: 14 }));
  logoutBtn.appendChild(document.createTextNode("Cerrar sesión"));
  logoutBtn.addEventListener("click", onLogout);
  actions.appendChild(logoutBtn);

  header.appendChild(actions);

  function setThemeBtnLabel(theme) {
    themeBtn.innerHTML = "";
    const dark = theme !== "light";
    themeBtn.appendChild(buildIcon(dark ? "sun" : "moon", { size: 14 }));
    themeBtn.appendChild(document.createTextNode(dark ? "Claro" : "Oscuro"));
  }

  return { header, tabButtons, setThemeBtnLabel };
}
