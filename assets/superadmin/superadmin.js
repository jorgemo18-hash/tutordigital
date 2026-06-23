import { apiFetch } from "../shared/js/auth.js";
import { createEstadisticasView } from "./views/estadisticas.js";
import { createCentroDetalleView } from "./views/centro-detalle.js";
import { createPapeleraView } from "./views/papelera.js";
import { initMobileSuper } from "./mobile/mobileSuper.js";

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

// ── Helpers ────────────────────────────────────────────────────────────────
function escHtml(str) {
  return String(str || "")
    .replace(/&/g, "&amp;").replace(/</g, "&lt;")
    .replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function slugify(s) {
  return s.toLowerCase().trim()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return "Buenos días";
  if (h < 20) return "Buenas tardes";
  return "Buenas noches";
}

function nowLabel() {
  return new Date().toLocaleDateString("es-ES", { weekday: "long", day: "numeric", month: "long" });
}

const TYPE_MAP = {
  academia:            { label: "Academia",            badge: "academia",            color: "#d6a64a" },
  instituto_integrado: { label: "Instituto integrado", badge: "instituto_integrado",  color: "#8fb2c9" },
  standalone:          { label: "Stand-alone",          badge: "standalone",          color: "#9fc096" },
};

const ESTADO_MAP = {
  active:   { cls: "activo",   label: "Activo"    },
  trial:    { cls: "prueba",   label: "Prueba"    },
  inactive: { cls: "pausado",  label: "Pausado"   },
  pending:  { cls: "pendiente",label: "Pendiente" },
};

function typeBadge(type) {
  const m = TYPE_MAP[type];
  if (!m) return `<span class="sa-badge">${escHtml(type || "—")}</span>`;
  return `<span class="sa-badge ${m.badge}">${m.label}</span>`;
}

function estadoBadge(status) {
  const m = ESTADO_MAP[status] || { cls: "pausado", label: status || "—" };
  return `<span class="sa-estado ${m.cls}"><span class="dot"></span>${m.label}</span>`;
}

function centroIni(name) {
  return escHtml((name || "?")[0].toUpperCase());
}

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
    if (key === "inicio")   renderInicio();
    if (key === "centros")  renderCentros();

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
    if (activePanel === "inicio")  renderInicio();
    if (activePanel === "centros") renderCentros();
  }

  // ── Stats globales (fuente de verdad para los 4 KPIs de Inicio) ───────
  async function loadStats() {
    const res = await apiFetch("/api/v1/superadmin/stats");
    if (!res.ok) return;
    const data = await res.json().catch(() => ({}));
    globalStats = data?.data || {};
    if (activePanel === "inicio") renderInicio();
  }

  // ── Render: Inicio ─────────────────────────────────────────────────────
  function renderInicio() {
    const panel = document.getElementById("view-inicio");
    if (!panel) return;

    const nActive   = globalStats.centros_activos  ?? 0;
    const nStudents = globalStats.alumnos_totales  ?? 0;
    const nSessions = globalStats.sesiones_mes     ?? 0;
    const nTeachers = globalStats.docentes_totales ?? 0;

    const recent5 = allTenants
      .slice().sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
      .slice(0, 5);

    const rows = recent5.map(t => `
      <div class="sa-trow sa-trow--centros" data-slug="${escHtml(t.slug)}" role="button" tabindex="0">
        <div class="sa-centro">
          <div class="sa-centro-av">${centroIni(t.name)}</div>
          <div class="sa-centro-info">
            <span class="sa-centro-name">${escHtml(t.name)}</span>
            <span class="sa-centro-loc">${TYPE_MAP[t.type]?.label || escHtml(t.type || "—")}</span>
          </div>
        </div>
        ${typeBadge(t.type)}
        <span class="sa-slug">${escHtml(t.slug)}</span>
        <span class="sa-alumnos${(t.active_students ?? 0) === 0 ? " zero" : ""}">
          ${(t.active_students ?? 0).toLocaleString("es-ES")}
          <small>${(t.active_students ?? 0) === 1 ? "alumno" : "alumnos"}</small>
        </span>
        ${estadoBadge(t.status || "active")}
      </div>`).join("");

    panel.innerHTML = `
      <header class="sa-head">
        <div>
          <div class="sa-head-eye">${getGreeting()}, ${escHtml(firstName)}</div>
          <h1 class="sa-head-title">Inicio</h1>
          <div class="sa-head-meta">
            <span>${allTenants.length} centros</span>
            <span class="sep">·</span>
            <span>${nStudents.toLocaleString("es-ES")} alumnos</span>
            <span class="sep">·</span>
            <span>${nowLabel()}</span>
          </div>
        </div>
      </header>

      <div class="sa-metrics">
        <div class="sa-metric${nActive > 0 ? " featured" : ""}">
          <span class="sa-metric-eye">Centros activos</span>
          <span class="sa-metric-num">${nActive.toLocaleString("es-ES")}</span>
          <span class="sa-metric-foot"><span class="dot"></span>en producción</span>
        </div>
        <div class="sa-metric">
          <span class="sa-metric-eye">Alumnos totales</span>
          <span class="sa-metric-num">${nStudents.toLocaleString("es-ES")}</span>
          <span class="sa-metric-foot"><span class="dot"></span>en la plataforma</span>
        </div>
        <div class="sa-metric">
          <span class="sa-metric-eye">Sesiones este mes</span>
          <span class="sa-metric-num">${nSessions.toLocaleString("es-ES")}</span>
          <span class="sa-metric-foot"><span class="dot"></span>con el tutor IA</span>
        </div>
        <div class="sa-metric">
          <span class="sa-metric-eye">Docentes totales</span>
          <span class="sa-metric-num">${nTeachers.toLocaleString("es-ES")}</span>
          <span class="sa-metric-foot"><span class="dot"></span>en todos los centros</span>
        </div>
      </div>

      <section class="sa-panel">
        <div class="sa-panel-head">
          <div>
            <h2 class="sa-panel-title">Centros recientes</h2>
            <div class="sa-panel-sub">${recent5.length} de ${allTenants.length} total</div>
          </div>
          <button class="sa-link" id="saVerTodosBtn">Ver todos los centros →</button>
        </div>
        <div class="sa-toolbar">
          <div></div>
          <button class="sa-btn" id="saNewCentroBtn">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg>
            Nuevo centro
          </button>
        </div>
        <div class="sa-table">
          <div class="sa-thead sa-thead--centros">
            <span class="sa-th">Centro</span>
            <span class="sa-th">Tipo</span>
            <span class="sa-th">Slug</span>
            <span class="sa-th r">Alumnos</span>
            <span class="sa-th r">Estado</span>
          </div>
          <div class="sa-tbody">
            ${rows || `<div style="padding:20px 16px;font-family:var(--mono);font-size:11px;color:rgba(242,237,229,0.35)">Sin centros todavía</div>`}
          </div>
        </div>
      </section>`;

    document.getElementById("saVerTodosBtn")?.addEventListener("click", () => showView("centros"));
    document.getElementById("saNewCentroBtn")?.addEventListener("click", () => openNuevoView("inicio"));
    wireRowClicks(panel);
  }

  // ── Render: Centros ────────────────────────────────────────────────────
  function renderCentros() {
    const panel = document.getElementById("view-centros");
    if (!panel) return;

    const FILTERS = [
      { k: "todos",               label: "Todos" },
      { k: "academia",            label: "Academia" },
      { k: "instituto_integrado", label: "Instituto integrado" },
      { k: "standalone",          label: "Stand-alone" },
    ];

    function buildRows(items) {
      if (!items.length) return `<div style="padding:20px 16px;font-family:var(--mono);font-size:11px;color:rgba(242,237,229,0.35)">Sin centros</div>`;
      return items.map(t => `
        <div class="sa-trow sa-trow--centros-full" data-slug="${escHtml(t.slug)}" role="button" tabindex="0">
          <div class="sa-centro">
            <div class="sa-centro-av">${centroIni(t.name)}</div>
            <div class="sa-centro-info">
              <span class="sa-centro-name">${escHtml(t.name)}</span>
              <span class="sa-centro-loc">${TYPE_MAP[t.type]?.label || escHtml(t.type || "—")}</span>
            </div>
          </div>
          ${typeBadge(t.type)}
          <span class="sa-slug">${escHtml(t.slug)}</span>
          <span class="sa-alumnos${(t.active_students ?? 0) === 0 ? " zero" : ""}">
            ${(t.active_students ?? 0).toLocaleString("es-ES")}
            <small>${(t.active_students ?? 0) === 1 ? "alumno" : "alumnos"}</small>
          </span>
          ${estadoBadge(t.status || "active")}
        </div>`).join("");
    }

    function counts() {
      const c = {};
      FILTERS.forEach(f => {
        c[f.k] = f.k === "todos" ? allTenants.length : allTenants.filter(t => t.type === f.k).length;
      });
      return c;
    }

    const cnt = counts();

    const pendingTenants = allTenants.filter(t => t.status === "pending");
    const activeTenants  = allTenants.filter(t => t.status !== "pending");

    function buildPendingRows(items) {
      if (!items.length) return `<div style="padding:16px;font-size:12px;color:rgba(242,237,229,.35)">Sin solicitudes pendientes</div>`;
      return items.map(t => `
        <div class="sa-trow sa-trow--centros-full" style="gap:12px">
          <div class="sa-centro">
            <div class="sa-centro-av" style="background:rgba(255,200,100,.15);color:#ffc864">${centroIni(t.name)}</div>
            <div class="sa-centro-info">
              <span class="sa-centro-name">${escHtml(t.name)}</span>
              <span class="sa-centro-loc">${TYPE_MAP[t.type]?.label || escHtml(t.type || "—")}</span>
            </div>
          </div>
          ${typeBadge(t.type)}
          <span class="sa-slug">${escHtml(t.slug)}</span>
          <span class="sa-alumnos zero">—</span>
          ${estadoBadge("pending")}
          <button class="sa-btn sa-btn--sm" data-approve-slug="${escHtml(t.slug)}" type="button">Aprobar</button>
        </div>`).join("");
    }

    panel.innerHTML = `
      <header class="sa-head">
        <div>
          <div class="sa-head-eye">Control global</div>
          <h1 class="sa-head-title">Centros</h1>
        </div>
      </header>
      <section class="sa-panel" id="pendingSection" style="${pendingTenants.length ? "" : "display:none"}">
        <div class="sa-panel-head">
          <div>
            <h2 class="sa-panel-title">Pendientes de aprobación</h2>
            <div class="sa-panel-sub">${pendingTenants.length} solicitud${pendingTenants.length !== 1 ? "es" : ""}</div>
          </div>
        </div>
        <div class="sa-table">
          <div class="sa-thead sa-thead--centros-full">
            <span class="sa-th">Centro</span><span class="sa-th">Tipo</span>
            <span class="sa-th">Slug</span><span class="sa-th r">Alumnos</span>
            <span class="sa-th r">Estado</span><span class="sa-th"></span>
          </div>
          <div class="sa-tbody" id="pendingTbody">${buildPendingRows(pendingTenants)}</div>
        </div>
      </section>
      <section class="sa-panel">
        <div class="sa-panel-head">
          <div>
            <h2 class="sa-panel-title">Todos los centros</h2>
            <div class="sa-panel-sub" id="centrosSubtitle">${activeTenants.length} centros · curso activo</div>
          </div>
          <button class="sa-btn" id="saNewCentroBtnCentros">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg>
            Nuevo centro
          </button>
        </div>
        <div class="sa-toolbar">
          <div class="sa-filters" id="centrosFilters">
            ${FILTERS.map(f => `
              <button class="sa-filter${f.k === "todos" ? " active" : ""}" data-filter="${f.k}">
                ${f.label}<span class="n">${cnt[f.k]}</span>
              </button>`).join("")}
          </div>
        </div>
        <div class="sa-table">
          <div class="sa-thead sa-thead--centros-full">
            <span class="sa-th">Centro</span>
            <span class="sa-th">Tipo</span>
            <span class="sa-th">Slug</span>
            <span class="sa-th r">Alumnos</span>
            <span class="sa-th r">Estado</span>
          </div>
          <div class="sa-tbody" id="centrosTbody">${buildRows(activeTenants)}</div>
        </div>
      </section>`;

    document.getElementById("saNewCentroBtnCentros")?.addEventListener("click", () => openNuevoView("centros"));

    document.getElementById("centrosFilters")?.addEventListener("click", e => {
      const btn = e.target.closest(".sa-filter");
      if (!btn) return;
      document.querySelectorAll("#centrosFilters .sa-filter").forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      const f = btn.dataset.filter;
      const filtered = f === "todos" ? activeTenants : activeTenants.filter(t => t.type === f);
      const tbody = document.getElementById("centrosTbody");
      if (tbody) tbody.innerHTML = buildRows(filtered);
      const sub = document.getElementById("centrosSubtitle");
      if (sub) sub.textContent = `${filtered.length} centro${filtered.length !== 1 ? "s" : ""} · curso activo`;
      wireRowClicks(panel);
    });

    document.getElementById("pendingTbody")?.addEventListener("click", async e => {
      const btn = e.target.closest("[data-approve-slug]");
      if (!btn) return;
      const slug = btn.dataset.approveSlug;
      if (!slug) return;
      btn.disabled = true;
      btn.textContent = "Aprobando…";
      try {
        const res = await apiFetch(`/api/v1/superadmin/tenants/${slug}/approve`, { method: "POST" });
        if (!res.ok) throw new Error("approve failed");
        await loadTenants();
      } catch {
        btn.disabled = false;
        btn.textContent = "Aprobar";
        alert("No se pudo aprobar el centro. Inténtalo de nuevo.");
      }
    });

    wireRowClicks(panel);
  }

  function wireRowClicks(container) {
    container.querySelectorAll(".sa-trow[data-slug]").forEach(row =>
      row.addEventListener("click", (e) => {
        if (e.target.closest("button")) return;
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
  let nuevoFromPanel = "inicio";

  function openNuevoView(from) {
    nuevoFromPanel = from || "inicio";
    if (!nuevoFormReady) buildNuevoForm();
    else resetNuevoForm();
    showView("nuevo");
  }

  function resetNuevoForm() {
    const panel = document.getElementById("view-nuevo");
    if (!panel) return;
    const q = id => panel.querySelector(`#${id}`);
    ["saNewName","saNewSlug","saNewAdminFirst","saNewAdminLast","saNewAdminEmail"].forEach(id => { const el = q(id); if (el) el.value = ""; });
    if (q("saNewSlug")) q("saNewSlug")._touched = false;
    const err = q("saFormError"); if (err) err.textContent = "";
    const btn = q("saFormConfirmBtn"); if (btn) { btn.disabled = false; btn.textContent = "Crear centro"; }
    // Reset type radios
    panel.querySelectorAll("#saTypeRadios .sa-radio").forEach(r => r.classList.remove("active"));
    panel._selectedType = "";
    // Reset status radios — volver a "trial" por defecto
    panel.querySelectorAll("#saStatusRadios .sa-radio").forEach(r => r.classList.remove("active"));
    panel.querySelector("#saStatusRadios .sa-radio[data-status='trial']")?.classList.add("active");
    panel._selectedStatus = "trial";
  }

  function buildNuevoForm() {
    const panel = document.getElementById("view-nuevo");
    if (!panel) return;
    nuevoFormReady = true;
    panel._selectedType   = "";
    panel._selectedStatus = "trial";

    const TIPOS = [
      { k: "academia",            label: "Academia",            color: "#d6a64a", sub: "Gestión administrativa completa" },
      { k: "instituto_integrado", label: "Instituto integrado", color: "#8fb2c9", sub: "Conectado con Google Classroom" },
      { k: "standalone",          label: "Stand-alone",          color: "#9fc096", sub: "Sin sistema externo" },
    ];

    panel.innerHTML = `
      <header class="sa-head">
        <div>
          <div class="sa-head-eye">Alta de centro cliente</div>
          <h1 class="sa-head-title">Nuevo <em>centro</em></h1>
          <div class="sa-head-meta">
            <span>Se enviará una invitación al administrador</span>
          </div>
        </div>
        <div class="sa-head-controls">
          <button class="sa-back-btn" id="saNuevoBackBtn">
            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>
            Volver
          </button>
        </div>
      </header>

      <div class="sa-form">
        <div class="sa-form-section">
          <div class="sa-form-eye">Datos del centro</div>

          <div class="sa-field">
            <label class="sa-flabel">Nombre del centro</label>
            <input class="sa-input" id="saNewName" type="text" placeholder="p. ej. Academia Lyceo" />
          </div>

          <div class="sa-field">
            <label class="sa-flabel">Tipo de centro</label>
            <div class="sa-radio-row" id="saTypeRadios">
              ${TIPOS.map(t => `
                <button class="sa-radio" type="button" data-type="${t.k}">
                  <span class="sa-radio-name">
                    <span class="sa-radio-dot" style="background:${t.color}"></span>${t.label}
                  </span>
                  <span class="sa-radio-sub">${t.sub}</span>
                </button>`).join("")}
            </div>
          </div>

          <div class="sa-field">
            <label class="sa-flabel">Slug <span class="sa-fhelp">· se genera del nombre</span></label>
            <input class="sa-input mono" id="saNewSlug" type="text" placeholder="academia-lyceo" />
          </div>
        </div>

        <div class="sa-form-section">
          <div class="sa-form-eye">Administrador del centro</div>
          <div class="sa-field-two">
            <div class="sa-field">
              <label class="sa-flabel">Nombre(s)</label>
              <input class="sa-input" id="saNewAdminFirst" type="text" placeholder="Jorge" />
            </div>
            <div class="sa-field">
              <label class="sa-flabel">Apellidos</label>
              <input class="sa-input" id="saNewAdminLast" type="text" placeholder="Moreno García" />
            </div>
          </div>
          <div class="sa-field">
            <label class="sa-flabel">Email <span class="sa-fhelp">· recibirá la invitación de acceso</span></label>
            <input class="sa-input mono" id="saNewAdminEmail" type="email" placeholder="admin@centro.es" />
          </div>
        </div>

        <div class="sa-form-section">
          <div class="sa-form-eye">Estado inicial</div>
          <div class="sa-radio-row" id="saStatusRadios">
            <button class="sa-radio active" type="button" data-status="trial">
              <span class="sa-radio-name">
                <span class="sa-radio-dot" style="background:#d6a64a"></span>Prueba
              </span>
              <span class="sa-radio-sub">14 días gratis</span>
            </button>
            <button class="sa-radio" type="button" data-status="active">
              <span class="sa-radio-name">
                <span class="sa-radio-dot" style="background:#9fc096"></span>Activo
              </span>
              <span class="sa-radio-sub">Facturación inmediata</span>
            </button>
            <button class="sa-radio" type="button" data-status="inactive">
              <span class="sa-radio-name">
                <span class="sa-radio-dot" style="background:rgba(242,237,229,0.35)"></span>Pausado
              </span>
              <span class="sa-radio-sub">Sin acceso aún</span>
            </button>
          </div>
        </div>

        <p class="sa-form-error" id="saFormError"></p>

        <div class="sa-form-foot">
          <button class="sa-btn-ghost" type="button" id="saFormCancelBtn">Cancelar</button>
          <button class="sa-btn" type="button" id="saFormConfirmBtn">
            <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12l5 5L20 7"/></svg>
            Crear centro
          </button>
        </div>
      </div>`;

    panel.querySelector("#saNuevoBackBtn")?.addEventListener("click", () => showView(nuevoFromPanel));
    panel.querySelector("#saFormCancelBtn")?.addEventListener("click", () => showView(nuevoFromPanel));

    // Type radios
    panel.querySelector("#saTypeRadios")?.addEventListener("click", e => {
      const btn = e.target.closest(".sa-radio[data-type]");
      if (!btn) return;
      panel.querySelectorAll("#saTypeRadios .sa-radio").forEach(r => r.classList.remove("active"));
      btn.classList.add("active");
      panel._selectedType = btn.dataset.type;
    });

    // Status radios
    panel.querySelector("#saStatusRadios")?.addEventListener("click", e => {
      const btn = e.target.closest(".sa-radio[data-status]");
      if (!btn) return;
      panel.querySelectorAll("#saStatusRadios .sa-radio").forEach(r => r.classList.remove("active"));
      btn.classList.add("active");
      panel._selectedStatus = btn.dataset.status;
    });

    // Slug auto-generation
    const nameInput = panel.querySelector("#saNewName");
    const slugInput = panel.querySelector("#saNewSlug");
    nameInput?.addEventListener("input", e => {
      if (!slugInput._touched) slugInput.value = slugify(e.target.value);
    });
    slugInput?.addEventListener("input", e => { e.target._touched = e.target.value.length > 0; });

    // Submit
    panel.querySelector("#saFormConfirmBtn")?.addEventListener("click", async () => {
      const name       = panel.querySelector("#saNewName").value.trim();
      const slug       = panel.querySelector("#saNewSlug").value.trim();
      const type       = panel._selectedType   || "";
      const status     = panel._selectedStatus || "trial";
      const adminFirst = panel.querySelector("#saNewAdminFirst").value.trim();
      const adminLast  = panel.querySelector("#saNewAdminLast").value.trim();
      const adminEmail = panel.querySelector("#saNewAdminEmail").value.trim();
      const errEl      = panel.querySelector("#saFormError");
      const confirmBtn = panel.querySelector("#saFormConfirmBtn");

      errEl.textContent = "";
      if (!name)       { errEl.textContent = "El nombre del centro es obligatorio."; return; }
      if (!slug)       { errEl.textContent = "El slug es obligatorio."; return; }
      if (!adminFirst) { errEl.textContent = "El nombre del administrador es obligatorio."; return; }
      if (!adminLast)  { errEl.textContent = "Los apellidos son obligatorios."; return; }
      if (!adminEmail) { errEl.textContent = "El email del administrador es obligatorio."; return; }

      confirmBtn.disabled = true;
      confirmBtn.textContent = "Creando…";

      try {
        const body = { name, slug, status, admin: { first_name: adminFirst, last_name: adminLast, email: adminEmail } };
        if (type) body.type = type;
        const res = await apiFetch("/api/v1/superadmin/tenants", {
          method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) { errEl.textContent = data?.error?.message || "No se pudo crear el centro."; return; }
        await loadTenants();
        showView("inicio");
      } catch {
        errEl.textContent = "Error de red. Inténtalo de nuevo.";
      } finally {
        confirmBtn.disabled = false;
        confirmBtn.textContent = "Crear centro";
      }
    });

    setTimeout(() => panel.querySelector("#saNewName")?.focus(), 60);
  }

  // ── Init ───────────────────────────────────────────────────────────────
  Promise.all([loadTenants(), loadStats()]).then(() => showView("inicio"));

  initMobileSuper({ adminName: displayName, onLogout: doLogout })
    .catch(err => console.error("[superadmin] mobile init failed:", err));
}
