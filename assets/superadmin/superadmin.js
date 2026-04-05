// ── Auth guard ─────────────────────────────────────────────────────────
const token = (() => {
  try { return localStorage.getItem("ttd_access_token"); } catch { return null; }
})();
if (!token) { window.location.href = "/"; }

// ── Panel switching ────────────────────────────────────────────────────
const PANEL_TITLES = {
  centros:  "Centros",
  stats:    "Estadísticas",
  users:    "Usuarios",
  billing:  "Facturación",
  config:   "Configuración",
};

const ACTION_LABELS = {
  centros: "+ Nuevo centro",
  stats:   null,
  users:   "+ Nuevo usuario",
  billing: null,
  config:  null,
};

const navItems  = document.querySelectorAll(".saNavItem");
const panels    = document.querySelectorAll(".saPanel");
const titleEl   = document.getElementById("saTopbarTitle");
const actionBtn = document.getElementById("saActionBtn");

function activatePanel(panelKey) {
  navItems.forEach((btn) => btn.classList.toggle("active", btn.dataset.panel === panelKey));
  panels.forEach((panel) => panel.classList.toggle("active", panel.id === `panel-${panelKey}`));

  if (titleEl) titleEl.textContent = PANEL_TITLES[panelKey] || panelKey;

  if (actionBtn) {
    const label = ACTION_LABELS[panelKey];
    if (label) {
      actionBtn.textContent = label;
      actionBtn.hidden = false;
    } else {
      actionBtn.hidden = true;
    }
  }
}

navItems.forEach((btn) => {
  btn.addEventListener("click", () => activatePanel(btn.dataset.panel));
});

// ── Logout ─────────────────────────────────────────────────────────────
document.getElementById("saLogoutBtn")?.addEventListener("click", () => {
  try { localStorage.removeItem("ttd_access_token"); } catch {}
  window.location.href = "/";
});
