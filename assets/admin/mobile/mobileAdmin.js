// mobileAdmin.js — Mobile admin panel orchestrator. Builds the 4-tab shell
// (Inicio, Grupos, Profes., Alumnos) and boots only on narrow viewports —
// same gating pattern as the teacher panel's mobileTeacher.js.

import { armBaseGuard, hasOpenGuard, triggerTopGuard } from "../../shared/js/mobileBackGuard.js";
import { setupSwipeGuard } from "../../shared/js/mobileSwipeGuard.js";
import { renderAdminInicio } from "./tabs/mobileAdminInicio.js";
import { renderAdminGrupos } from "./tabs/mobileAdminGrupos.js";
import { renderAdminProfes } from "./tabs/mobileAdminProfes.js";
import { renderAdminAlumnos } from "./tabs/mobileAdminAlumnos.js";

const TABS = [
  { key: "inicio", label: "Inicio",  icon: "🏠" },
  { key: "grupos", label: "Grupos",  icon: "📚" },
  { key: "profes", label: "Profes.", icon: "🧑‍🏫" },
  { key: "alumnos", label: "Alumnos", icon: "🎓" },
];

function _isMobile() {
  return window.matchMedia("(max-width: 768px)").matches;
}

function _buildShell() {
  const app = document.createElement("div");
  app.className = "ad-app";
  app.id = "adApp";
  app.innerHTML = `
    <div class="ad-pages" id="adPages">
      ${TABS.map(t => `<div class="ad-page" id="adPage-${t.key}" data-page="${t.key}"></div>`).join("")}
    </div>
    <div class="ad-backdrop" id="adBackdrop"></div>
    <div class="ad-sheet" id="adSheet">
      <div class="ad-sheet-handle"></div>
      <div class="ad-sheet-content" id="adSheetContent"></div>
    </div>
    <nav class="ad-tabbar" id="adTabbar">
      ${TABS.map(t => `
        <button type="button" class="ad-tab-btn" data-tab="${t.key}">
          <span class="ad-tab-icon">${t.icon}</span>
          <span class="ad-tab-label">${t.label}</span>
        </button>`).join("")}
    </nav>`;
  return app;
}

export async function initMobileAdmin(ctx) {
  if (!_isMobile()) return;

  const app = _buildShell();
  document.body.appendChild(app);

  const sheetEl    = app.querySelector("#adSheet");
  const backdropEl = app.querySelector("#adBackdrop");
  const pages      = {};
  TABS.forEach(t => { pages[t.key] = app.querySelector(`#adPage-${t.key}`); });

  const adminName = ctx.state?.me?.user?.display_name || ctx.state?.me?.user?.email || "";
  const tenantName = ctx.state?.tenantName || "";

  const renderers = {
    inicio: () => renderAdminInicio({
      containerEl: pages.inicio, fetchJSON: ctx.fetchJSON, adminName, tenantName,
      goToTab: switchTab, roleFlags: ctx.roleFlags, goTeacher: ctx.goTeacher, goStudent: ctx.goStudent,
      onLogout: ctx.onLogout,
    }),
    grupos: () => renderAdminGrupos({ containerEl: pages.grupos, sheetEl, backdropEl, fetchJSON: ctx.fetchJSON }),
    profes: () => renderAdminProfes({ containerEl: pages.profes, sheetEl, backdropEl, fetchJSON: ctx.fetchJSON, teacherDrawer: ctx.teacherDrawer }),
    alumnos: () => renderAdminAlumnos({ containerEl: pages.alumnos, sheetEl, backdropEl, fetchJSON: ctx.fetchJSON, tenantName }),
  };

  async function switchTab(key, { autoOpen } = {}) {
    if (!TABS.some(t => t.key === key)) return;

    TABS.forEach(t => {
      pages[t.key].classList.toggle("ad-page--active", t.key === key);
      app.querySelector(`[data-tab="${t.key}"]`).classList.toggle("ad-tab-btn--active", t.key === key);
    });

    await renderers[key]();

    if (autoOpen) {
      const trigger = pages[key].querySelector(autoOpen);
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
