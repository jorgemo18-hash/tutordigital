// mobileAdmin.js — Mobile admin panel orchestrator. Builds the 4-tab shell
// (Inicio, Grupos, Profes., Alumnos) and boots only on narrow viewports.
// Structure/classes match the confirmed reference design exactly
// (tutordiseño/gestor/admin_movil.jsx) — see _mobile-admin.css.

import { armBaseGuard, hasOpenGuard, triggerTopGuard } from "../../shared/js/mobileBackGuard.js";
import { setupSwipeGuard } from "../../shared/js/mobileSwipeGuard.js";
import { icon } from "./mobileAdminIcons.js";
import { renderAdminInicio } from "./tabs/mobileAdminInicio.js";
import { renderAdminGrupos } from "./tabs/mobileAdminGrupos.js";
import { renderAdminProfes } from "./tabs/mobileAdminProfes.js";
import { renderAdminAlumnos } from "./tabs/mobileAdminAlumnos.js";

const TABS = [
  { key: "inicio",  iconName: "grid",  label: "Inicio" },
  { key: "grupos",  iconName: "group", label: "Grupos" },
  { key: "profes",  iconName: "board", label: "Profes." },
  { key: "alumnos", iconName: "cap",   label: "Alumnos" },
];

function _isMobile() {
  return window.matchMedia("(max-width: 768px)").matches;
}

function _buildShell() {
  const app = document.createElement("div");
  app.className = "ad-app";
  app.id = "adApp";
  app.innerHTML = `
    ${TABS.map(t => `
      <div class="view" id="adView-${t.key}" data-view="${t.key}">
        <div class="scroll" id="adScroll-${t.key}"></div>
      </div>`).join("")}

    <div id="adDrillHost"></div>

    <nav class="tabbar" id="adTabbar">
      ${TABS.map((t, i) => `
        <button type="button" class="tabbar-btn${i === 0 ? " active" : ""}" data-tab="${t.key}">
          ${icon(t.iconName, { size: 24, sw: i === 0 ? 1.9 : 1.6 })}
          <span>${t.label}</span>
        </button>`).join("")}
    </nav>

    <div class="sheet-scrim" id="adScrim"></div>
    <div class="sheet" id="adSheet">
      <div class="sheet-grip"></div>
      <div id="adSheetContent"></div>
    </div>`;
  return app;
}

export async function initMobileAdmin(ctx) {
  if (!_isMobile()) return;

  const app = _buildShell();
  document.body.appendChild(app);

  const sheetEl    = app.querySelector("#adSheet");
  const backdropEl = app.querySelector("#adScrim");
  const drillHost  = app.querySelector("#adDrillHost");
  const scrolls    = {};
  TABS.forEach(t => { scrolls[t.key] = app.querySelector(`#adScroll-${t.key}`); });

  const adminName  = ctx.state?.me?.user?.display_name || ctx.state?.me?.user?.email || "";
  const tenantName = ctx.state?.tenantName || "";

  const renderers = {
    inicio: () => renderAdminInicio({
      containerEl: scrolls.inicio, fetchJSON: ctx.fetchJSON, adminName, tenantName,
      goToTab: switchTab, roleFlags: ctx.roleFlags, goTeacher: ctx.goTeacher, goStudent: ctx.goStudent,
      onLogout: ctx.onLogout,
    }),
    grupos: () => renderAdminGrupos({ containerEl: scrolls.grupos, drillHost, sheetEl, backdropEl, fetchJSON: ctx.fetchJSON }),
    profes: () => renderAdminProfes({ containerEl: scrolls.profes, sheetEl, backdropEl, fetchJSON: ctx.fetchJSON, teacherDrawer: ctx.teacherDrawer }),
    alumnos: () => renderAdminAlumnos({ containerEl: scrolls.alumnos, sheetEl, backdropEl, fetchJSON: ctx.fetchJSON, tenantName }),
  };

  async function switchTab(key, { autoOpen } = {}) {
    if (!TABS.some(t => t.key === key)) return;

    TABS.forEach(t => {
      app.querySelector(`#adView-${t.key}`).classList.toggle("view--active", t.key === key);
      app.querySelector(`[data-tab="${t.key}"]`).classList.toggle("active", t.key === key);
    });

    await renderers[key]();

    if (autoOpen) {
      const trigger = scrolls[key].querySelector(autoOpen);
      trigger?.click();
    }
  }

  app.querySelectorAll("[data-tab]").forEach(btn => {
    btn.addEventListener("click", () => switchTab(btn.dataset.tab));
  });

  armBaseGuard();
  setupSwipeGuard(app, { hasOpenLayer: hasOpenGuard, closeTopLayer: triggerTopGuard });

  await switchTab("inicio");
}
