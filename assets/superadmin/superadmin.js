import { apiFetch } from "../shared/js/auth.js";
import { createEstadisticasView } from "./views/estadisticas.js";
import { createCentroDetalleView } from "./views/centro-detalle.js";
import { createPapeleraView } from "./views/papelera.js";

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

const TYPE_LABELS = {
  academia:            "Academia",
  instituto_integrado: "Instituto integrado",
  standalone:          "Stand-alone",
};

const STATUS_MAP = {
  active:   ["activo",   "Activo"],
  trial:    ["prueba",   "Prueba"],
  inactive: ["inactivo", "Inactivo"],
};

function estadoBadge(status) {
  const [cls, lbl] = STATUS_MAP[status] || ["inactivo", status];
  return `<span class="sa-estado ${cls}">${lbl}</span>`;
}

// ── Main init ──────────────────────────────────────────────────────────────
function initSuperadmin(user) {
  const displayName = user.display_name || "Admin";
  const firstName   = displayName.split(/[\s_]/)[0];
  const initial     = displayName[0]?.toUpperCase() || "A";

  const avatarEl = document.getElementById("saAvatar");
  const nameEl   = document.getElementById("saName");
  if (avatarEl) avatarEl.textContent = initial;
  if (nameEl)   nameEl.textContent   = displayName;

  // ── Theme ──────────────────────────────────────────────────────────────
  const themeBtn   = document.getElementById("saThemeBtn");
  const themeLabel = document.getElementById("saThemeLabel");

  function applyTheme(isLight) {
    document.documentElement.classList.toggle("light", isLight);
    try { localStorage.setItem("td-theme", isLight ? "light" : "dark"); } catch {}
    if (themeLabel) themeLabel.textContent = isLight ? "Modo oscuro" : "Modo claro";
  }
  applyTheme(document.documentElement.classList.contains("light"));
  themeBtn?.addEventListener("click", () =>
    applyTheme(!document.documentElement.classList.contains("light"))
  );

  // ── Logout ─────────────────────────────────────────────────────────────
  document.getElementById("saLogoutBtn")?.addEventListener("click", () => {
    try { localStorage.removeItem("ttd_access_token"); } catch {}
    window.location.href = "/";
  });

  // ── View switching ─────────────────────────────────────────────────────
  const views    = document.querySelectorAll(".sa-view");
  const navItems = document.querySelectorAll(".sa-nav-item[data-panel]");

  const statsView    = createEstadisticasView(document.getElementById("view-stats"));
  const detalleView  = createCentroDetalleView(document.getElementById("view-detalle"));
  const papeleraView = createPapeleraView(document.getElementById("view-papelera"), loadTenants);

  let allTenants  = [];
  let activePanel = "";
  let prevPanel   = "inicio";

  function showView(key) {
    if (activePanel === "detalle" && key !== "detalle") detalleView.hide();

    prevPanel   = (activePanel && activePanel !== key) ? activePanel : prevPanel;
    activePanel = key;

    views.forEach(v => v.classList.toggle("active", v.id === `view-${key}`));
    navItems.forEach(btn => btn.classList.toggle("active", btn.dataset.panel === key));

    if (key === "stats")    statsView.init(allTenants);
    if (key === "papelera") papeleraView.init();
    if (key === "inicio")   renderInicio();
    if (key === "centros")  renderCentros();
  }

  navItems.forEach(btn => btn.addEventListener("click", () => showView(btn.dataset.panel)));

  // ── Tenants ────────────────────────────────────────────────────────────
  async function loadTenants() {
    const res = await apiFetch("/api/v1/superadmin/tenants");
    if (res.status === 403) { window.location.href = "/"; return; }
    if (!res.ok) return;
    const data = await res.json().catch(() => ({}));
    allTenants = data?.data?.items || [];
    if (activePanel === "inicio")  renderInicio();
    if (activePanel === "centros") renderCentros();
  }

  // ── Render: Inicio ─────────────────────────────────────────────────────
  function renderInicio() {
    const panel = document.getElementById("view-inicio");
    if (!panel) return;

    const active   = allTenants.filter(t => t.status === "active").length;
    const students = allTenants.reduce((s, t) => s + (t.active_students || 0), 0);
    const sessions = allTenants.reduce((s, t) => s + (t.sessions_this_month || 0), 0);
    const teachers = allTenants.reduce((s, t) => s + (t.active_teachers || 0), 0);

    const recent5 = allTenants
      .slice()
      .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
      .slice(0, 5);

    const rows = recent5.map(t => `
      <div class="sa-trow sa-trow--centros" data-slug="${escHtml(t.slug)}" role="button" tabindex="0">
        <div class="sa-td sa-td--name">${escHtml(t.name)}</div>
        <div class="sa-td sa-td--mono">${escHtml(TYPE_LABELS[t.type] || t.type || "—")}</div>
        <div class="sa-td">${t.active_students ?? 0}</div>
        <div class="sa-td">${estadoBadge(t.status || "active")}</div>
        <div class="sa-td sa-td--action">Ver →</div>
      </div>`).join("");

    panel.innerHTML = `
      <div class="sa-head">
        <div>
          <div class="sa-head-sub">${getGreeting()}, ${escHtml(firstName)}</div>
          <h1 class="sa-head-title">Inicio</h1>
        </div>
        <div class="sa-head-right">
          <button class="btn-primary" id="saNewCentroBtn" type="button">+ Nuevo centro</button>
        </div>
      </div>

      <div class="sa-metrics">
        <div class="sa-metric">
          <div class="sa-metric-label">Centros activos</div>
          <div class="sa-metric-value">${active || allTenants.length || "—"}</div>
          <div class="sa-metric-sub">en producción</div>
        </div>
        <div class="sa-metric">
          <div class="sa-metric-label">Alumnos totales</div>
          <div class="sa-metric-value sa-metric-value--neutral">${students || "—"}</div>
          <div class="sa-metric-sub">registrados</div>
        </div>
        <div class="sa-metric">
          <div class="sa-metric-label">Sesiones este mes</div>
          <div class="sa-metric-value sa-metric-value--neutral">${sessions || "—"}</div>
          <div class="sa-metric-sub">con el tutor IA</div>
        </div>
        <div class="sa-metric">
          <div class="sa-metric-label">Docentes totales</div>
          <div class="sa-metric-value sa-metric-value--neutral">${teachers || "—"}</div>
          <div class="sa-metric-sub">en todos los centros</div>
        </div>
      </div>

      <div class="sa-card">
        <div class="sa-card-head">
          <div style="display:flex;align-items:center;gap:8px">
            <span class="sa-card-title">Centros recientes</span>
            <span class="sa-card-count">${allTenants.length}</span>
          </div>
          <button class="sa-ver-todos" id="saVerTodosBtn" type="button">Ver todos los centros →</button>
        </div>
        <div class="sa-thead sa-thead--centros">
          <div class="sa-th">Centro</div>
          <div class="sa-th">Tipo</div>
          <div class="sa-th">Alumnos</div>
          <div class="sa-th">Estado</div>
          <div class="sa-th"></div>
        </div>
        <div class="sa-tbody" id="saRecentTbody">
          ${rows || `<div class="sa-empty-row">Sin centros todavía</div>`}
        </div>
      </div>`;

    document.getElementById("saNewCentroBtn")?.addEventListener("click", () => openNuevoView("inicio"));
    document.getElementById("saVerTodosBtn")?.addEventListener("click", () => showView("centros"));
    wireRowClicks(panel);
  }

  // ── Render: Centros ────────────────────────────────────────────────────
  function renderCentros() {
    const panel = document.getElementById("view-centros");
    if (!panel) return;

    const FILTERS = [
      { value: "todos",                label: "Todos" },
      { value: "academia",             label: "Academia" },
      { value: "instituto_integrado",  label: "Instituto integrado" },
      { value: "standalone",           label: "Stand-alone" },
    ];

    function buildRows(items) {
      if (!items.length) return `<div class="sa-empty-row">Sin centros que coincidan</div>`;
      return items.map(t => `
        <div class="sa-trow sa-trow--centros-full" data-slug="${escHtml(t.slug)}" role="button" tabindex="0">
          <div class="sa-td sa-td--name">${escHtml(t.name)}</div>
          <div class="sa-td sa-td--mono">${escHtml(TYPE_LABELS[t.type] || t.type || "—")}</div>
          <div class="sa-td sa-td--mono">${escHtml(t.slug)}</div>
          <div class="sa-td">${t.active_students ?? 0}</div>
          <div class="sa-td">${estadoBadge(t.status || "active")}</div>
          <div class="sa-td sa-td--action">Ver →</div>
        </div>`).join("");
    }

    panel.innerHTML = `
      <div class="sa-head">
        <div><h1 class="sa-head-title">Todos los centros</h1></div>
        <div class="sa-head-right">
          <button class="btn-primary" id="saNewCentroBtnCentros" type="button">+ Nuevo centro</button>
        </div>
      </div>
      <div class="sa-card">
        <div class="sa-card-head">
          <div style="display:flex;align-items:center;gap:8px">
            <span class="sa-card-title">Centros</span>
            <span class="sa-card-count" id="centrosCount">${allTenants.length}</span>
          </div>
          <div class="filter-chips" id="centrosChips">
            ${FILTERS.map(f => `<button class="chip${f.value === "todos" ? " active" : ""}" data-filter="${f.value}">${f.label}</button>`).join("")}
          </div>
        </div>
        <div class="sa-thead sa-thead--centros-full">
          <div class="sa-th">Centro</div>
          <div class="sa-th">Tipo</div>
          <div class="sa-th">Slug</div>
          <div class="sa-th">Alumnos</div>
          <div class="sa-th">Estado</div>
          <div class="sa-th"></div>
        </div>
        <div class="sa-tbody" id="centrosTbody">${buildRows(allTenants)}</div>
      </div>`;

    document.getElementById("saNewCentroBtnCentros")?.addEventListener("click", () => openNuevoView("centros"));

    const chipsEl = document.getElementById("centrosChips");
    const tbodyEl = document.getElementById("centrosTbody");
    const countEl = document.getElementById("centrosCount");

    chipsEl?.addEventListener("click", e => {
      const chip = e.target.closest(".chip");
      if (!chip) return;
      chipsEl.querySelectorAll(".chip").forEach(c => c.classList.remove("active"));
      chip.classList.add("active");
      const f = chip.dataset.filter;
      const filtered = f === "todos" ? allTenants : allTenants.filter(t => t.type === f);
      if (countEl) countEl.textContent = filtered.length;
      if (tbodyEl) tbodyEl.innerHTML = buildRows(filtered);
      wireRowClicks(panel);
    });

    wireRowClicks(panel);
  }

  function wireRowClicks(container) {
    container.querySelectorAll(".sa-trow[data-slug]").forEach(row =>
      row.addEventListener("click", () => {
        const t = allTenants.find(x => x.slug === row.dataset.slug);
        if (t) showTenantDetail(t);
      })
    );
  }

  // ── Tenant detail ──────────────────────────────────────────────────────
  function showTenantDetail(tenant) {
    const from = activePanel;
    detalleView.show(tenant, () => showView(from || "inicio"));
    showView("detalle");
  }

  // ── Nuevo centro (inline view) ─────────────────────────────────────────
  let nuevoFormReady = false;

  function openNuevoView(from) {
    if (from) prevPanel = from;
    if (!nuevoFormReady) buildNuevoForm();
    else clearNuevoForm();
    showView("nuevo");
    setTimeout(() => document.getElementById("saNewName")?.focus(), 60);
  }

  function clearNuevoForm() {
    const panel = document.getElementById("view-nuevo");
    if (!panel) return;
    const byId = id => panel.querySelector(`#${id}`);
    byId("saNewName").value        = "";
    byId("saNewSlug").value        = "";
    byId("saNewSlug")._touched     = false;
    byId("saNewType").value        = "";
    byId("saNewAdminFirst").value  = "";
    byId("saNewAdminLast").value   = "";
    byId("saNewAdminEmail").value  = "";
    byId("saFormError").textContent = "";
    const btn = byId("saFormConfirmBtn");
    btn.disabled = false;
    btn.textContent = "Crear centro";
  }

  function buildNuevoForm() {
    const panel = document.getElementById("view-nuevo");
    if (!panel) return;
    nuevoFormReady = true;

    panel.innerHTML = `
      <div class="sa-head">
        <div>
          <button class="sa-back-btn" id="saNuevoBackBtn" type="button">← Volver</button>
          <h1 class="sa-head-title">Nuevo centro</h1>
        </div>
      </div>
      <div class="sa-form-wrap">
        <form class="sa-form" id="saNewCentroForm" autocomplete="off">
          <label class="sa-field">
            <span>Nombre del centro *</span>
            <input id="saNewName" type="text" placeholder="Academia Ramón y Cajal" />
          </label>
          <label class="sa-field">
            <span>Slug * <small>(minúsculas, números y guiones)</small></span>
            <input id="saNewSlug" type="text" placeholder="academia-ramon-cajal" />
          </label>
          <label class="sa-field">
            <span>Tipo de centro</span>
            <select id="saNewType">
              <option value="">Sin especificar</option>
              <option value="academia">Academia — gestión administrativa completa</option>
              <option value="instituto_integrado">Instituto integrado — conectado con Google Classroom</option>
              <option value="standalone">Stand-alone — sin sistema externo</option>
            </select>
          </label>
          <div class="sa-form-section">Administrador del centro</div>
          <div class="sa-field-row">
            <label class="sa-field">
              <span>Nombre(s) *</span>
              <input id="saNewAdminFirst" type="text" placeholder="Jorge" />
            </label>
            <label class="sa-field">
              <span>Apellidos *</span>
              <input id="saNewAdminLast" type="text" placeholder="Moreno García" />
            </label>
          </div>
          <label class="sa-field">
            <span>Email de acceso *</span>
            <input id="saNewAdminEmail" type="email" placeholder="admin@centro.es" />
          </label>
          <p class="sa-form-error" id="saFormError"></p>
          <div class="sa-form-actions">
            <button class="btn-ghost" type="button" id="saFormCancelBtn">Cancelar</button>
            <button class="btn-primary" type="button" id="saFormConfirmBtn">Crear centro</button>
          </div>
        </form>
      </div>`;

    panel.querySelector("#saNuevoBackBtn")?.addEventListener("click", () => showView(prevPanel));
    panel.querySelector("#saFormCancelBtn")?.addEventListener("click", () => showView(prevPanel));

    const nameInput = panel.querySelector("#saNewName");
    const slugInput = panel.querySelector("#saNewSlug");

    nameInput?.addEventListener("input", e => {
      if (!slugInput._touched) {
        slugInput.value = e.target.value
          .toLowerCase()
          .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
          .replace(/[^a-z0-9]+/g, "-")
          .replace(/^-|-$/g, "");
      }
    });
    slugInput?.addEventListener("input", e => {
      e.target._touched = e.target.value.length > 0;
    });

    panel.querySelector("#saFormConfirmBtn")?.addEventListener("click", async () => {
      const name       = panel.querySelector("#saNewName").value.trim();
      const slug       = panel.querySelector("#saNewSlug").value.trim();
      const type       = panel.querySelector("#saNewType").value;
      const adminFirst = panel.querySelector("#saNewAdminFirst").value.trim();
      const adminLast  = panel.querySelector("#saNewAdminLast").value.trim();
      const adminEmail = panel.querySelector("#saNewAdminEmail").value.trim();
      const errEl      = panel.querySelector("#saFormError");
      const confirmBtn = panel.querySelector("#saFormConfirmBtn");

      errEl.textContent = "";
      if (!name)       { errEl.textContent = "El nombre del centro es obligatorio."; return; }
      if (!slug)       { errEl.textContent = "El slug es obligatorio."; return; }
      if (!adminFirst) { errEl.textContent = "El nombre del administrador es obligatorio."; return; }
      if (!adminLast)  { errEl.textContent = "Los apellidos del administrador son obligatorios."; return; }
      if (!adminEmail) { errEl.textContent = "El email del administrador es obligatorio."; return; }

      confirmBtn.disabled = true;
      confirmBtn.textContent = "Creando…";

      try {
        const body = {
          name, slug,
          admin: { first_name: adminFirst, last_name: adminLast, email: adminEmail },
        };
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
        await loadTenants();
        showView("inicio");
      } catch {
        errEl.textContent = "Error de red. Inténtalo de nuevo.";
      } finally {
        confirmBtn.disabled = false;
        confirmBtn.textContent = "Crear centro";
      }
    });
  }

  // ── Init ───────────────────────────────────────────────────────────────
  loadTenants().then(() => showView("inicio"));
}
