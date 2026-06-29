import { apiFetch } from "../shared/js/auth.js";
import { createEstadisticasView } from "./views/estadisticas.js";
import { createCentroDetalleView } from "./views/centro-detalle.js";
import { createPapeleraView } from "./views/papelera.js";
import { initMobileSuper } from "./mobile/mobileSuper.js";
import { renderInicio } from "./views/renderInicio.js";
import { renderCentros } from "./views/renderCentros.js";
import { buildNuevoForm, resetNuevoForm } from "./views/nuevoCentroForm.js";

function doLogout() {
  try { localStorage.removeItem("ttd_access_token"); } catch {}
  window.location.href = "/login";
}

// ── Auth guard ─────────────────────────────────────────────────────────────
(async () => {
  try {
    const res = await apiFetch("/api/v1/me");
    if (!res.ok) { window.location.href = "/login"; return; }
    const data = await res.json().catch(() => ({}));
    if (data?.data?.user?.is_superadmin !== true) { window.location.href = "/login"; return; }
    initSuperadmin(data?.data?.user || {});
  } catch {
    window.location.href = "/login";
  }
})();

// ── Main init ──────────────────────────────────────────────────────────────
function initSuperadmin(user) {
  const displayName = user.display_name || "Admin";
  const firstName   = displayName.split(/[\s_]/)[0];
  const initials    = displayName.split(/[\s_]/).filter(Boolean).slice(0, 2).map(w => w[0]).join("").toUpperCase() || "A";

  const avatarEl = document.getElementById("saAvatar");
  const nameEl   = document.getElementById("saName");
  if (avatarEl) avatarEl.textContent = initials;
  if (nameEl)   nameEl.textContent   = displayName;

  // ── Logout ─────────────────────────────────────────────────────────────
  document.getElementById("saLogoutBtn")?.addEventListener("click", doLogout);

  // ── Theme toggle ────────────────────────────────────────────────────────
  function syncSaThemeBtn() {
    const isDark = (document.documentElement.dataset.theme || "dark") !== "light";
    const btn = document.getElementById("saThemeToggle");
    if (!btn) return;
    const span = btn.querySelector("span");
    if (span) span.textContent = isDark ? "Modo claro" : "Modo oscuro";
  }

  document.getElementById("saThemeToggle")?.addEventListener("click", () => {
    const next = (document.documentElement.dataset.theme || "dark") === "dark" ? "light" : "dark";
    document.documentElement.dataset.theme = next;
    try { localStorage.setItem("ttdTheme", next); } catch {}
    syncSaThemeBtn();
  });

  syncSaThemeBtn();

  // ── View switching ─────────────────────────────────────────────────────
  const views    = document.querySelectorAll(".sa-view");
  const navItems = document.querySelectorAll(".sa-nav-item[data-panel]");

  const statsView    = createEstadisticasView(document.getElementById("view-stats"));
  const detalleView  = createCentroDetalleView(document.getElementById("view-detalle"));
  const papeleraView = createPapeleraView(document.getElementById("view-papelera"), loadTenants);

  let allTenants  = [];
  let globalStats = {};
  let activePanel = "";

  function showView(key) {
    const prev = activePanel;
    if (prev === "detalle" && key !== "detalle") detalleView.hide();
    activePanel = key;

    views.forEach(v => v.classList.toggle("active", v.id === `view-${key}`));
    navItems.forEach(btn => btn.classList.toggle("active", btn.dataset.panel === key));

    if (key === "stats")    statsView.init(allTenants);
    if (key === "papelera") papeleraView.init();
    if (key === "inicio")   drawInicio();
    if (key === "centros")  drawCentros();

    return prev;
  }

  navItems.forEach(btn => btn.addEventListener("click", () => showView(btn.dataset.panel)));

  // ── Tenants ────────────────────────────────────────────────────────────
  async function loadTenants() {
    const res = await apiFetch("/api/v1/superadmin/tenants");
    if (res.status === 403) { window.location.href = "/login"; return; }
    if (!res.ok) return;
    const data = await res.json().catch(() => ({}));
    allTenants = data?.data?.items || [];
    if (activePanel === "inicio")  drawInicio();
    if (activePanel === "centros") drawCentros();
  }

  // ── Stats globales (fuente de verdad para los 4 KPIs de Inicio) ───────
  async function loadStats() {
    const res = await apiFetch("/api/v1/superadmin/stats");
    if (!res.ok) return;
    const data = await res.json().catch(() => ({}));
    globalStats = data?.data || {};
    if (activePanel === "inicio") drawInicio();
  }

  // ── Render: Inicio / Centros (HTML+wiring en views/render*.js) ────────
  function drawInicio() {
    renderInicio({
      panel: document.getElementById("view-inicio"),
      allTenants, globalStats, firstName,
      onVerTodos: () => showView("centros"),
      onNuevoCentro: () => openNuevoView("inicio"),
      onRowClick: showTenantDetail,
    });
  }

  function drawCentros() {
    renderCentros({
      panel: document.getElementById("view-centros"),
      allTenants,
      onNuevoCentro: () => openNuevoView("centros"),
      onApproved: loadTenants,
      onRowClick: showTenantDetail,
    });
  }

  // ── Tenant detail ──────────────────────────────────────────────────────
  function showTenantDetail(tenant) {
    const from = activePanel;
    detalleView.show(tenant, () => showView(from || "inicio"));
    showView("detalle");
  }

  // ── Nuevo centro (inline view) ─────────────────────────────────────────
  let nuevoFormReady = false;
  let nuevoFromPanel = "inicio";

  function openNuevoView(from) {
    nuevoFromPanel = from || "inicio";
    const panel = document.getElementById("view-nuevo");
    if (!nuevoFormReady) {
      nuevoFormReady = true;
      buildNuevoForm({
        panel,
        onBack: () => showView(nuevoFromPanel),
        onCreated: async () => { await loadTenants(); showView("inicio"); },
      });
    } else {
      resetNuevoForm(panel);
    }
    showView("nuevo");
  }

  // ── Init ───────────────────────────────────────────────────────────────
  Promise.all([loadTenants(), loadStats()]).then(() => showView("inicio"));

  initMobileSuper({ adminName: displayName, onLogout: doLogout })
    .catch(err => console.error("[superadmin] mobile init failed:", err));
}
