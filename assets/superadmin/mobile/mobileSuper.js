// mobileSuper.js — Mobile superadmin panel orchestrator. Same pattern as
// assets/admin/mobile/mobileAdmin.js: boots only on narrow viewports,
// mounts a fixed-position shell, gated entirely by CSS — no separate
// entry point, no redirect.

import { armBaseGuard, hasOpenGuard, triggerTopGuard, pushBackGuard, popBackGuard } from "../../shared/js/mobileBackGuard.js";
import { setupSwipeGuard } from "../../shared/js/mobileSwipeGuard.js";
import { icon } from "../../admin/mobile/mobileAdminIcons.js";
import { renderSuperInicio } from "./tabs/mobileSuperInicio.js";
import { renderSuperStats } from "./tabs/mobileSuperStats.js";
import { renderSuperPerfil } from "./tabs/mobileSuperPerfil.js";
import { renderSuperDetalle } from "./drills/mobileSuperDetalle.js";
import { renderSuperNuevo } from "./drills/mobileSuperNuevo.js";

const TABS = [
  { key: "inicio", iconName: "home",  label: "Inicio" },
  { key: "stats",  iconName: "stats", label: "Stats"  },
  { key: "perfil", iconName: "user",  label: "Perfil" },
];

function _isMobile() {
  return window.matchMedia("(max-width: 768px)").matches;
}

function _buildShell() {
  const app = document.createElement("div");
  app.className = "sp-app";
  app.id = "spApp";
  app.innerHTML = `
    ${TABS.map(t => `
      <div class="view" id="spView-${t.key}" data-view="${t.key}">
        <div class="scroll" id="spScroll-${t.key}"></div>
      </div>`).join("")}

    <div id="spDrillHost"></div>

    <nav class="tabbar" id="spTabbar">
      ${TABS.map((t, i) => `
        <button type="button" class="tabbar-btn${i === 0 ? " active" : ""}" data-tab="${t.key}">
          ${icon(t.iconName, { size: 24, sw: i === 0 ? 1.9 : 1.6 })}
          <span>${t.label}</span>
        </button>`).join("")}
    </nav>`;
  return app;
}

export async function initMobileSuper(ctx) {
  if (!_isMobile()) return;

  const app = _buildShell();
  document.body.appendChild(app);

  const drillHost = app.querySelector("#spDrillHost");
  const scrolls    = {};
  TABS.forEach(t => { scrolls[t.key] = app.querySelector(`#spScroll-${t.key}`); });

  const adminName = ctx.adminName || "";
  let inicioApi   = null;

  function _closeDrill() {
    drillHost.innerHTML = "";
    popBackGuard();
  }

  function _openDrill(renderFn) {
    renderFn();
    pushBackGuard(() => { drillHost.innerHTML = ""; });
  }

  function _openDetalle(tenant) {
    _openDrill(() => renderSuperDetalle({
      hostEl: drillHost, tenant,
      onBack: _closeDrill,
      onDeleted: async () => { _closeDrill(); await inicioApi?.refresh(); },
      onUpdated: async () => { await inicioApi?.refresh(); },
    }));
  }

  function _openNuevo() {
    _openDrill(() => renderSuperNuevo({
      hostEl: drillHost,
      onClose: _closeDrill,
      onCreated: async () => { _closeDrill(); await inicioApi?.refresh(); },
    }));
  }

  const renderers = {
    inicio: async () => { inicioApi = await renderSuperInicio({ containerEl: scrolls.inicio, onOpen: _openDetalle, onNew: _openNuevo }); },
    stats:  () => renderSuperStats({ containerEl: scrolls.stats }),
    perfil: () => renderSuperPerfil({ containerEl: scrolls.perfil, adminName, tenantsCount: inicioApi?.getCount() ?? 0, onLogout: ctx.onLogout }),
  };

  async function switchTab(key) {
    if (!TABS.some(t => t.key === key)) return;
    TABS.forEach(t => {
      app.querySelector(`#spView-${t.key}`).classList.toggle("view--active", t.key === key);
      app.querySelector(`[data-tab="${t.key}"]`).classList.toggle("active", t.key === key);
    });
    await renderers[key]();
  }

  app.querySelectorAll("[data-tab]").forEach(btn => {
    btn.addEventListener("click", () => switchTab(btn.dataset.tab));
  });

  armBaseGuard();
  setupSwipeGuard(app, { hasOpenLayer: hasOpenGuard, closeTopLayer: triggerTopGuard });

  await switchTab("inicio");
}
