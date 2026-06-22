import { requireSessionOrRedirect } from "../../shared/js/guard.js";
import { logout } from "../../shared/js/auth.js";
import { buildHeader } from "../../shared/js/header.js";
import { renderHorario } from "./js/horario.js";
import { renderDiario } from "./js/diario.js";

const TABS = [
  { id: "horario", label: "Horario", render: renderHorario },
  { id: "diario", label: "Diario", render: renderDiario },
];

function buildShell(root) {
  root.innerHTML = "";

  const header = document.createElement("header");
  header.className = "academiaHeader";
  const title = document.createElement("h1");
  title.textContent = "Panel del profesor";
  header.appendChild(title);
  const headerNav = document.createElement("div");
  headerNav.className = "academiaHeaderNav";
  header.appendChild(headerNav);
  root.appendChild(header);

  const tabs = document.createElement("nav");
  tabs.className = "academiaTabs";
  root.appendChild(tabs);

  const view = document.createElement("section");
  view.className = "academiaView";
  root.appendChild(view);

  return { headerNav, tabs, view };
}

function buildTabButtons(tabsContainer, onSelect) {
  const buttons = new Map();
  for (const tab of TABS) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "academiaTabBtn";
    btn.textContent = tab.label;
    btn.addEventListener("click", () => onSelect(tab.id));
    tabsContainer.appendChild(btn);
    buttons.set(tab.id, btn);
  }
  return buttons;
}

function init() {
  requireSessionOrRedirect({ requireTenant: true });

  const root = document.getElementById("academiaProfesorApp");
  const { headerNav, tabs, view } = buildShell(root);

  buildHeader(headerNav, {
    role: "teacher",
    btnClass: "headerAction",
    onLogout: async () => {
      await logout();
      window.location.href = "/login";
    },
  });

  let activeTabId = TABS[0].id;
  const tabButtons = buildTabButtons(tabs, selectTab);

  function selectTab(tabId) {
    activeTabId = tabId;
    for (const [id, btn] of tabButtons) {
      btn.classList.toggle("isActive", id === tabId);
    }
    const tab = TABS.find((t) => t.id === tabId);
    tab.render(view);
  }

  selectTab(activeTabId);
}

init();
