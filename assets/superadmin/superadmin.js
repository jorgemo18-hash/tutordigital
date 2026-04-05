import { apiFetch } from "../shared/js/auth.js";

// ── Auth guard ─────────────────────────────────────────────────────────────
const token = (() => {
  try { return localStorage.getItem("ttd_access_token"); } catch { return null; }
})();
if (!token) { window.location.href = "/"; }

// ── DOM refs ───────────────────────────────────────────────────────────────
const navItems  = document.querySelectorAll(".saNavItem");
const panels    = document.querySelectorAll(".saPanel");
const titleEl   = document.getElementById("saTopbarTitle");
const actionBtn = document.getElementById("saActionBtn");
const themeBtn  = document.getElementById("saThemeBtn");

// ── Panel switching ────────────────────────────────────────────────────────
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

function activatePanel(panelKey) {
  navItems.forEach((btn) => btn.classList.toggle("active", btn.dataset.panel === panelKey));
  panels.forEach((panel) => panel.classList.toggle("active", panel.id === `panel-${panelKey}`));
  if (titleEl) titleEl.textContent = PANEL_TITLES[panelKey] || panelKey;
  if (actionBtn) {
    const label = ACTION_LABELS[panelKey];
    actionBtn.textContent = label || "";
    actionBtn.hidden = !label;
  }
}

navItems.forEach((btn) => {
  btn.addEventListener("click", () => activatePanel(btn.dataset.panel));
});

// ── Theme toggle ───────────────────────────────────────────────────────────
function applyTheme(theme) {
  document.documentElement.dataset.theme = theme;
  try { localStorage.setItem("ttdTheme", theme); } catch {}
  if (themeBtn) themeBtn.textContent = theme === "dark" ? "☀︎" : "☾";
}

themeBtn?.addEventListener("click", () => {
  applyTheme(document.documentElement.dataset.theme === "dark" ? "light" : "dark");
});

if (themeBtn) {
  themeBtn.textContent = (document.documentElement.dataset.theme || "dark") === "dark" ? "☀︎" : "☾";
}

// ── Logout ─────────────────────────────────────────────────────────────────
document.getElementById("saLogoutBtn")?.addEventListener("click", () => {
  try { localStorage.removeItem("ttd_access_token"); } catch {}
  window.location.href = "/";
});

// ── Tenants API ────────────────────────────────────────────────────────────
function escHtml(str) {
  return String(str || "").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;");
}

function formatDate(iso) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("es-ES", { day: "2-digit", month: "short", year: "numeric" });
}

function renderTenantsTable(items) {
  const tbody = document.querySelector("#panel-centros .saTable tbody");
  const metricActive = document.querySelector("#panel-centros .saMetricCard:first-child .saMetricValue");

  if (metricActive) metricActive.textContent = items.length;

  if (!tbody) return;

  if (!items.length) {
    tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;color:var(--muted);padding:24px">Sin centros todavía</td></tr>`;
    return;
  }

  tbody.innerHTML = items.map((t) => `
    <tr>
      <td class="saTableName">${escHtml(t.name)}</td>
      <td>${escHtml(t.type || "—")}</td>
      <td><code>${escHtml(t.slug)}</code></td>
      <td>${t.active_students ?? 0}</td>
      <td><span class="saBadge active">Activo</span></td>
      <td><button class="saBtn ghost small" type="button">Ver</button></td>
    </tr>
  `).join("");
}

async function loadTenants() {
  const tbody = document.querySelector("#panel-centros .saTable tbody");
  if (tbody) tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;color:var(--muted);padding:24px">Cargando…</td></tr>`;

  const res = await apiFetch("/api/v1/superadmin/tenants");

  if (res.status === 403) { window.location.href = "/"; return; }

  if (!res.ok) {
    if (tbody) tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;color:var(--muted);padding:24px">Error al cargar los centros</td></tr>`;
    return;
  }

  const data = await res.json().catch(() => ({}));
  renderTenantsTable(data?.data?.items || []);
}

// ── Create tenant modal ────────────────────────────────────────────────────
function ensureCreateModal() {
  let modal = document.getElementById("saCreateTenantModal");
  if (modal) return modal;

  modal = document.createElement("div");
  modal.id = "saCreateTenantModal";
  modal.className = "saModalOverlay";
  modal.innerHTML = `
    <div class="saModalCard">
      <div class="saModalHeader">
        <h2 class="saModalTitle">Nuevo centro</h2>
        <button class="saModalClose" type="button" aria-label="Cerrar">✕</button>
      </div>
      <div class="saModalBody">
        <label class="saField">
          <span>Nombre *</span>
          <input id="saNewName" type="text" placeholder="IES Ramón y Cajal" autocomplete="off" />
        </label>
        <label class="saField">
          <span>Slug * <small>(solo minúsculas, números y guiones)</small></span>
          <input id="saNewSlug" type="text" placeholder="ies-ramon-cajal" autocomplete="off" />
        </label>
        <label class="saField">
          <span>Tipo</span>
          <select id="saNewType">
            <option value="">Sin especificar</option>
            <option value="academia">Academia</option>
            <option value="instituto">Instituto</option>
            <option value="colegio">Colegio</option>
            <option value="otro">Otro</option>
          </select>
        </label>
        <p class="saModalError" id="saModalError"></p>
      </div>
      <div class="saModalFooter">
        <button class="saBtn ghost" type="button" id="saModalCancelBtn">Cancelar</button>
        <button class="saBtn primary" type="button" id="saModalConfirmBtn">Crear centro</button>
      </div>
    </div>
  `;

  document.body.appendChild(modal);

  const close = () => modal.classList.remove("open");
  modal.querySelector(".saModalClose").addEventListener("click", close);
  modal.querySelector("#saModalCancelBtn").addEventListener("click", close);
  modal.addEventListener("click", (e) => { if (e.target === modal) close(); });

  // Auto-slug from name
  modal.querySelector("#saNewName").addEventListener("input", (e) => {
    const slugInput = modal.querySelector("#saNewSlug");
    if (!slugInput._touched) {
      slugInput.value = e.target.value
        .toLowerCase()
        .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "");
    }
  });
  modal.querySelector("#saNewSlug").addEventListener("input", (e) => {
    e.target._touched = e.target.value.length > 0;
  });

  modal.querySelector("#saModalConfirmBtn").addEventListener("click", async () => {
    const name = modal.querySelector("#saNewName").value.trim();
    const slug = modal.querySelector("#saNewSlug").value.trim();
    const type = modal.querySelector("#saNewType").value;
    const errEl = modal.querySelector("#saModalError");
    const confirmBtn = modal.querySelector("#saModalConfirmBtn");

    errEl.textContent = "";
    if (!name) { errEl.textContent = "El nombre es obligatorio."; return; }
    if (!slug) { errEl.textContent = "El slug es obligatorio."; return; }

    confirmBtn.disabled = true;
    confirmBtn.textContent = "Creando…";

    try {
      const body = { name, slug };
      if (type) body.type = type;

      const res = await apiFetch("/api/v1/superadmin/tenants", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        errEl.textContent = data?.error?.message || "No se pudo crear el centro.";
        return;
      }

      close();
      await loadTenants();
    } catch {
      errEl.textContent = "Error de red. Inténtalo de nuevo.";
    } finally {
      confirmBtn.disabled = false;
      confirmBtn.textContent = "Crear centro";
    }
  });

  return modal;
}

actionBtn?.addEventListener("click", () => {
  if (actionBtn.textContent.includes("Nuevo centro")) {
    const modal = ensureCreateModal();
    modal.querySelector("#saNewName").value = "";
    modal.querySelector("#saNewSlug").value = "";
    modal.querySelector("#saNewSlug")._touched = false;
    modal.querySelector("#saNewType").value = "";
    modal.querySelector("#saModalError").textContent = "";
    modal.classList.add("open");
    setTimeout(() => modal.querySelector("#saNewName").focus(), 50);
  }
});

// ── Init ───────────────────────────────────────────────────────────────────
loadTenants();
