import { requireSessionOrRedirect } from "../../../shared/js/guard.js";
import { logout } from "../../../shared/js/auth.js";
import { getTheme, saveTheme } from "../../../shared/js/header.js";
import { buildIcon } from "./icons.js";
import { fetchMe } from "./api.js";
import { renderHorario } from "./horario.js";
import { renderDiario } from "./diario.js";

const TABS = [
  { id: "horario", label: "Horario", icon: "cal", render: renderHorario },
  { id: "diario", label: "Diario", icon: "book", render: renderDiario },
];

function temaClase(theme) {
  return theme === "light" ? "ac-claro" : "ac-oscuro";
}

function buildFrame(stage) {
  stage.innerHTML = "";
  const frame = document.createElement("div");
  frame.className = `ac-frame ${temaClase(getTheme())}`;
  stage.appendChild(frame);

  const photo = document.createElement("div");
  photo.className = "ac-photo";
  const veil = document.createElement("div");
  veil.className = "ac-veil";
  frame.append(photo, veil);

  const shell = document.createElement("div");
  shell.className = "ac-shell";
  frame.appendChild(shell);

  return { frame, shell };
}

function buildHeader(shell, { who, academia, onTabSelect, onThemeToggle, onLogout }) {
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
  for (const tab of TABS) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "ac-tab";
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

async function init() {
  requireSessionOrRedirect({ requireTenant: true });

  const stage = document.getElementById("academiaProfesorApp");
  const { frame, shell } = buildFrame(stage);

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

  let activeTabId = TABS[0].id;

  const { header: headerEl, tabButtons, setThemeBtnLabel } = buildHeader(shell, {
    who: me.displayName || "Profesor",
    academia: me.tenantName || "Academia",
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

  const body = document.createElement("div");
  body.className = "ac-body";
  shell.appendChild(body);

  function selectTab(tabId) {
    activeTabId = tabId;
    for (const [id, btn] of tabButtons) btn.classList.toggle("active", id === tabId);
    const tab = TABS.find((t) => t.id === tabId);
    tab.render(body);
  }

  setThemeBtnLabel(getTheme());
  selectTab(activeTabId);
}

init();
