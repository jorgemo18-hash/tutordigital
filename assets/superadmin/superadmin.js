import { apiFetch } from "../shared/js/auth.js";
import { createEstadisticasView } from "./views/estadisticas.js";
import { createCentroDetalleView } from "./views/centro-detalle.js";

// ── Auth guard ─────────────────────────────────────────────────────────────
(async () => {
  try {
    const res = await apiFetch("/api/v1/me");
    if (!res.ok) { window.location.href = "/"; return; }
    const data = await res.json().catch(() => ({}));
    if (data?.data?.user?.is_superadmin !== true) { window.location.href = "/"; return; }
    initSuperadmin(data?.data?.user || {});
  } catch {
    window.location.href = "/";
  }
})();

// ── Helpers ────────────────────────────────────────────────────────────────
function escHtml(str) {
  return String(str || "")
    .replace(/&/g, "&amp;").replace(/</g, "&lt;")
    .replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return "Buenos días";
  if (h < 20) return "Buenas tardes";
  return "Buenas noches";
}

// ── Main init ──────────────────────────────────────────────────────────────
function initSuperadmin(user) {

  // ── User info in sidebar ─────────────────────────────────────────────────
  const displayName = user.display_name || "Admin";
  const firstName   = displayName.split(/[\s_]/)[0];
  const initial     = displayName[0]?.toUpperCase() || "A";

  const avatarEl   = document.getElementById("sbAvatar");
  const usernameEl = document.getElementById("sbUsername");
  const greetingEl = document.getElementById("saGreeting");

  if (avatarEl)   avatarEl.textContent   = initial;
  if (usernameEl) usernameEl.textContent = displayName;
  if (greetingEl) greetingEl.textContent = `${getGreeting()}, ${firstName}`;

  // ── DOM refs ─────────────────────────────────────────────────────────────
  const navItems  = document.querySelectorAll(".sb-item");
  const panels    = document.querySelectorAll(".panel");
  const titleEl   = document.getElementById("saTopbarTitle");
  const actionBtn = document.getElementById("saActionBtn");
  const themeBtn  = document.getElementById("saThemeBtn");

  // ── Vistas por panel ──────────────────────────────────────────────────────
  const statsView   = createEstadisticasView(document.getElementById("panel-stats"));
  const detalleView = createCentroDetalleView(document.getElementById("panel-centros"));
  let inDetailMode  = false;

  // ── Panel switching ──────────────────────────────────────────────────────
  const PANEL_TITLES = {
    centros: "Inicio",
    stats:   "Estadísticas",
    users:   "Usuarios",
    billing: "Facturación",
    config:  "Configuración",
  };

  const ACTION_LABELS = {
    centros: "+ Nuevo centro",
    users:   "+ Nuevo usuario",
  };

  function activatePanel(key) {
    // Exit detail mode if active
    if (inDetailMode) {
      detalleView.hide();
      inDetailMode = false;
    }
    navItems.forEach((btn) => btn.classList.toggle("active", btn.dataset.panel === key));
    panels.forEach((p)   => p.classList.toggle("active", p.id === `panel-${key}`));
    if (titleEl)   titleEl.textContent  = PANEL_TITLES[key] || key;
    const greetEl = document.getElementById("saGreeting");
    if (greetEl)   greetEl.textContent  = `${getGreeting()}, ${firstName}`;
    if (actionBtn) {
      actionBtn.onclick = null;
      const label = ACTION_LABELS[key] || null;
      actionBtn.textContent = label || "";
      actionBtn.hidden = !label;
    }
    if (key === "stats") {
      statsView.init(allTenants);
    } else {
      statsView.hide();
    }
  }

  // ── Delegación de eventos para Ver detalle ────────────────────────────────
  document.getElementById("panel-centros")?.addEventListener("click", (e) => {
    const btn = e.target.closest("button.cell-action");
    if (!btn) return;
    const tenant = allTenants.find(t => t.slug === btn.dataset.slug);
    if (tenant) showTenantDetail(tenant);
  });

  function showTenantDetail(tenant) {
    inDetailMode = true;
    // Update topbar
    const greetEl = document.getElementById("saGreeting");
    if (greetEl)  greetEl.textContent  = "Viendo detalle de centro";
    if (titleEl)  titleEl.textContent  = tenant.name;
    if (actionBtn) {
      actionBtn.textContent = "← Volver a centros";
      actionBtn.hidden = false;
      actionBtn.onclick = () => activatePanel("centros");
    }
    detalleView.show(tenant, () => activatePanel("centros"));
  }

  navItems.forEach((btn) => btn.addEventListener("click", () => activatePanel(btn.dataset.panel)));

  // ── Theme toggle ─────────────────────────────────────────────────────────
  function applyTheme(isLight) {
    document.documentElement.classList.toggle("light", isLight);
    try { localStorage.setItem("td-theme", isLight ? "light" : "dark"); } catch {}
    if (themeBtn) themeBtn.textContent = isLight ? "☾" : "☀︎";
  }

  const isLightNow = document.documentElement.classList.contains("light");
  if (themeBtn) themeBtn.textContent = isLightNow ? "☾" : "☀︎";

  themeBtn?.addEventListener("click", () => {
    applyTheme(!document.documentElement.classList.contains("light"));
  });

  // ── Logout ───────────────────────────────────────────────────────────────
  document.getElementById("saLogoutBtn")?.addEventListener("click", () => {
    try { localStorage.removeItem("ttd_access_token"); } catch {}
    window.location.href = "/";
  });

  // ── Tenants ───────────────────────────────────────────────────────────────
  let allTenants = [];

  function renderTenantsTable(items) {
    const tbody    = document.getElementById("tenantsTbody");
    const countEl  = document.getElementById("tenantsCount");
    const metricEl = document.getElementById("metricCentros");

    if (metricEl) metricEl.textContent = allTenants.length;
    if (countEl)  countEl.textContent  = items.length;
    if (!tbody)   return;

    if (!items.length) {
      tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;color:var(--text-muted);padding:24px">Sin centros todavía</td></tr>`;
      return;
    }

    tbody.innerHTML = items.map((t) => {
      const status = t.status || "active";
      const badgeMap = { active: "active", trial: "trial", inactive: "inactive" };
      const labelMap = { active: "Activo", trial: "Prueba", inactive: "Inactivo" };
      const badgeClass = badgeMap[status] || "inactive";
      const badgeLabel = labelMap[status] || status;

      return `
        <tr>
          <td class="cell-name">${escHtml(t.name)}</td>
          <td style="font-family:var(--mono);font-size:11px;color:var(--text-muted)">${escHtml(t.type || "—")}</td>
          <td><code>${escHtml(t.slug)}</code></td>
          <td>${t.active_students ?? 0}</td>
          <td><span class="badge ${badgeClass}">${badgeLabel}</span></td>
          <td><button class="cell-action" type="button" data-slug="${escHtml(t.slug)}">Ver detalle →</button></td>
        </tr>
      `;
    }).join("");

  }

  async function loadTenants() {
    const tbody = document.getElementById("tenantsTbody");
    if (tbody) tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;color:var(--text-muted);padding:24px">Cargando…</td></tr>`;

    const res = await apiFetch("/api/v1/superadmin/tenants");
    if (res.status === 403) { window.location.href = "/"; return; }

    if (!res.ok) {
      if (tbody) tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;color:var(--text-muted);padding:24px">Error al cargar los centros</td></tr>`;
      return;
    }

    const data = await res.json().catch(() => ({}));
    allTenants = data?.data?.items || [];
    renderTenantsTable(allTenants);
  }

  // ── Filter chips ─────────────────────────────────────────────────────────
  const chips = document.querySelectorAll(".chip");
  chips.forEach((chip) => {
    chip.addEventListener("click", () => {
      chips.forEach((c) => c.classList.remove("active"));
      chip.classList.add("active");
      const f = chip.dataset.filter;
      renderTenantsTable(f === "todos" ? allTenants : allTenants.filter((t) => t.type === f));
    });
  });

  // ── Create tenant modal ───────────────────────────────────────────────────
  function ensureCreateModal() {
    let modal = document.getElementById("saCreateTenantModal");
    if (modal) return modal;

    modal = document.createElement("div");
    modal.id = "saCreateTenantModal";
    modal.className = "modal-overlay";
    modal.innerHTML = `
      <div class="modal-card">
        <div class="modal-header">
          <h2 class="modal-title">Nuevo centro</h2>
          <button class="modal-close" type="button" aria-label="Cerrar">✕</button>
        </div>
        <div class="modal-body">
          <label class="field">
            <span>Nombre del centro *</span>
            <input id="saNewName" type="text" placeholder="IES Ramón y Cajal" autocomplete="off" />
          </label>
          <label class="field">
            <span>Slug * <small>(solo minúsculas, números y guiones)</small></span>
            <input id="saNewSlug" type="text" placeholder="ies-ramon-cajal" autocomplete="off" />
          </label>
          <label class="field">
            <span>Tipo</span>
            <select id="saNewType">
              <option value="">Sin especificar</option>
              <option value="academia">Academia</option>
              <option value="instituto">Instituto</option>
              <option value="colegio">Colegio</option>
              <option value="otro">Otro</option>
            </select>
          </label>

          <div class="modal-section-label">Administrador del centro</div>

          <div class="modal-row">
            <label class="field">
              <span>Nombre(s) *</span>
              <input id="saNewAdminFirst" type="text" placeholder="Jorge" autocomplete="off" />
            </label>
            <label class="field">
              <span>Apellidos *</span>
              <input id="saNewAdminLast" type="text" placeholder="Moreno García" autocomplete="off" />
            </label>
          </div>
          <label class="field">
            <span>Email de acceso *</span>
            <input id="saNewAdminEmail" type="email" placeholder="admin@centro.es" autocomplete="off" />
          </label>
          <label class="field">
            <span>Teléfono <small>(opcional)</small></span>
            <input id="saNewAdminPhone" type="tel" placeholder="+34 600 000 000" autocomplete="off" />
          </label>

          <p class="modal-error" id="saModalError"></p>
        </div>
        <div class="modal-footer">
          <button class="btn-ghost" type="button" id="saModalCancelBtn">Cancelar</button>
          <button class="btn-primary" type="button" id="saModalConfirmBtn">Crear centro</button>
        </div>
      </div>
    `;
    document.body.appendChild(modal);

    const close = () => modal.classList.remove("open");
    modal.querySelector(".modal-close").addEventListener("click", close);
    modal.querySelector("#saModalCancelBtn").addEventListener("click", close);
    modal.addEventListener("click", (e) => { if (e.target === modal) close(); });

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
      const name       = modal.querySelector("#saNewName").value.trim();
      const slug       = modal.querySelector("#saNewSlug").value.trim();
      const type       = modal.querySelector("#saNewType").value;
      const firstName  = modal.querySelector("#saNewAdminFirst").value.trim();
      const lastName   = modal.querySelector("#saNewAdminLast").value.trim();
      const adminEmail = modal.querySelector("#saNewAdminEmail").value.trim();
      const adminPhone = modal.querySelector("#saNewAdminPhone").value.trim();
      const errEl      = modal.querySelector("#saModalError");
      const confirmBtn = modal.querySelector("#saModalConfirmBtn");

      errEl.textContent = "";
      if (!name)       { errEl.textContent = "El nombre del centro es obligatorio."; return; }
      if (!slug)       { errEl.textContent = "El slug es obligatorio."; return; }
      if (!firstName)  { errEl.textContent = "El nombre del administrador es obligatorio."; return; }
      if (!lastName)   { errEl.textContent = "Los apellidos del administrador son obligatorios."; return; }
      if (!adminEmail) { errEl.textContent = "El email del administrador es obligatorio."; return; }

      confirmBtn.disabled = true;
      confirmBtn.textContent = "Creando…";

      try {
        const body = { name, slug, admin: { first_name: firstName, last_name: lastName, email: adminEmail } };
        if (type)       body.type = type;
        if (adminPhone) body.admin.phone = adminPhone;

        const res = await apiFetch("/api/v1/superadmin/tenants", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });

        const data = await res.json().catch(() => ({}));
        if (!res.ok) { errEl.textContent = data?.error?.message || "No se pudo crear el centro."; return; }

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
    if (!actionBtn.textContent.includes("Nuevo centro")) return;
    const modal = ensureCreateModal();
    modal.querySelector("#saNewName").value = "";
    modal.querySelector("#saNewSlug").value = "";
    modal.querySelector("#saNewSlug")._touched = false;
    modal.querySelector("#saNewType").value = "";
    modal.querySelector("#saNewAdminFirst").value = "";
    modal.querySelector("#saNewAdminLast").value = "";
    modal.querySelector("#saNewAdminEmail").value = "";
    modal.querySelector("#saNewAdminPhone").value = "";
    modal.querySelector("#saModalError").textContent = "";
    modal.classList.add("open");
    setTimeout(() => modal.querySelector("#saNewName").focus(), 50);
  });

  // ── Init ──────────────────────────────────────────────────────────────────
  loadTenants();
}
