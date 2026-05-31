import { apiFetch } from "../../shared/js/auth.js";
import { openDeleteModal } from "./deleteTenantModal.js";

// ── Helpers ────────────────────────────────────────────────────────────────
function escHtml(str) {
  return String(str || "")
    .replace(/&/g, "&amp;").replace(/</g, "&lt;")
    .replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}
function relativeDate(iso) {
  if (!iso) return "—";
  const d = Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
  if (d === 0) return "hoy";
  if (d === 1) return "ayer";
  if (d < 30) return `hace ${d} días`;
  if (d < 365) return `hace ${Math.floor(d / 30)} meses`;
  return `hace ${Math.floor(d / 365)} años`;
}
function fmtDate(iso) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("es-ES", { day: "numeric", month: "long", year: "numeric" });
}

const STATUS_LABELS = { active: "Activo", trial: "Prueba", inactive: "Pausado" };
const STATUS_CLS    = { active: "activo", trial: "prueba", inactive: "pausado" };
const TYPE_LABELS   = {
  academia:            "Academia",
  instituto_integrado: "Instituto integrado",
  standalone:          "Stand-alone",
};
const TYPE_OPTS = ["academia", "instituto_integrado", "standalone"];

// ── HTML builders ──────────────────────────────────────────────────────────

function buildHead(t, onBack) {
  const status = t.status || "active";
  const cls    = STATUS_CLS[status] || "pausado";
  return `
    <header class="sa-head">
      <div>
        <div class="sa-head-eye">Viendo detalle de centro</div>
        <h1 class="sa-head-title">${escHtml(t.name)}</h1>
      </div>
      <div class="sa-head-controls">
        <button class="sa-back-btn" id="cdBackBtn">
          <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>
          Volver
        </button>
      </div>
    </header>
    <section class="sa-hero">
      <div class="sa-hero-left">
        <div class="sa-hero-av">${escHtml((t.name || "?")[0].toUpperCase())}</div>
        <div>
          <div class="sa-hero-name" id="cdHeaderName">${escHtml(t.name)}</div>
          <div class="sa-hero-meta">
            <span class="sa-estado-inline ${cls}"><span class="dot"></span>${STATUS_LABELS[status] || status}</span>
            <span class="sa-hero-slug">${escHtml(t.slug)}</span>
          </div>
        </div>
      </div>
      <button class="sa-btn-impersonate" id="cdAdminBtn" type="button">
        Entrar como admin
        <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14M13 5l7 7-7 7"/></svg>
      </button>
    </section>`;
}

function buildKPIs() {
  return `
    <div class="sa-metrics">
      <div class="sa-metric">
        <span class="sa-metric-eye">Alumnos</span>
        <span class="sa-metric-num" id="cdKpiAlumnos">—</span>
        <span class="sa-metric-foot"><span class="dot"></span>registrados</span>
      </div>
      <div class="sa-metric">
        <span class="sa-metric-eye">Docentes</span>
        <span class="sa-metric-num" id="cdKpiDocentes">—</span>
        <span class="sa-metric-foot"><span class="dot"></span>asignados</span>
      </div>
      <div class="sa-metric featured">
        <span class="sa-metric-eye">Grupos</span>
        <span class="sa-metric-num" id="cdKpiGrupos">—</span>
        <span class="sa-metric-foot"><span class="dot"></span>activos este curso</span>
      </div>
      <div class="sa-metric">
        <span class="sa-metric-eye">Sesiones este mes</span>
        <span class="sa-metric-num" id="cdKpiSesiones">—</span>
        <span class="sa-metric-foot"><span class="dot"></span>con el tutor IA</span>
      </div>
    </div>`;
}

function buildInfoPanel(t) {
  return `
    <section class="sa-panel" id="cdInfoPanel">
      <div class="sa-panel-head">
        <div><h2 class="sa-panel-title">Información del centro</h2></div>
        <button class="sa-link" id="cdEditBtn">
          <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7M18.5 2.5a2.12 2.12 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
          Editar
        </button>
      </div>
      <div id="cdInfoInner"></div>
    </section>`;
}

function renderInfoRead(t, ad) {
  return `
    <div class="sa-info-grid">
      <div>
        <div class="sa-info-eye">Datos del centro</div>
        <dl class="sa-dl">
          <div class="sa-dl-row"><dt class="sa-dt">Nombre</dt><dd class="sa-dd">${escHtml(t.name)}</dd></div>
          <div class="sa-dl-row"><dt class="sa-dt">Tipo</dt><dd class="sa-dd">${TYPE_LABELS[t.type] || "—"}</dd></div>
          <div class="sa-dl-row"><dt class="sa-dt">Slug</dt><dd class="sa-dd mono">${escHtml(t.slug)}</dd></div>
          <div class="sa-dl-row"><dt class="sa-dt">Creado</dt><dd class="sa-dd">${fmtDate(t.created_at)}</dd></div>
        </dl>
      </div>
      <div>
        <div class="sa-info-eye">Administrador del centro</div>
        <dl class="sa-dl">
          <div class="sa-dl-row"><dt class="sa-dt">Nombre</dt><dd class="sa-dd">${escHtml(ad.display_name || "—")}</dd></div>
          <div class="sa-dl-row"><dt class="sa-dt">Email</dt><dd class="sa-dd mono">${escHtml(ad.email || "—")}</dd></div>
          <div class="sa-dl-row"><dt class="sa-dt">Teléfono</dt><dd class="sa-dd mono">${escHtml(ad.phone || "—")}</dd></div>
        </dl>
      </div>
    </div>`;
}

function renderInfoEdit(t, ad) {
  const typeOpts = `<option value="">Sin especificar</option>` +
    TYPE_OPTS.map(v => `<option value="${v}"${t.type === v ? " selected" : ""}>${TYPE_LABELS[v]}</option>`).join("");
  return `
    <div class="sa-info-head">
      <span></span>
      <div style="display:flex;gap:8px">
        <button class="sa-btn-ghost" id="cdCancelBtn" type="button">Cancelar</button>
        <button class="sa-btn-save" id="cdSaveBtn" type="button">Guardar</button>
      </div>
    </div>
    <div class="sa-info-grid">
      <div>
        <div class="sa-info-eye">Datos del centro</div>
        <dl class="sa-dl">
          <div class="sa-dl-row"><dt class="sa-dt">Nombre</dt><dd class="sa-dd"><input class="sa-info-inp" id="cdEditName" type="text" value="${escHtml(t.name)}" /></dd></div>
          <div class="sa-dl-row"><dt class="sa-dt">Tipo</dt><dd class="sa-dd"><select class="sa-info-inp sa-info-sel" id="cdEditType">${typeOpts}</select></dd></div>
          <div class="sa-dl-row"><dt class="sa-dt">Slug</dt><dd class="sa-dd mono">${escHtml(t.slug)}</dd></div>
          <div class="sa-dl-row"><dt class="sa-dt">Creado</dt><dd class="sa-dd">${fmtDate(t.created_at)}</dd></div>
        </dl>
      </div>
      <div>
        <div class="sa-info-eye">Administrador del centro</div>
        <dl class="sa-dl">
          <div class="sa-dl-row"><dt class="sa-dt">Nombre</dt><dd class="sa-dd"><input class="sa-info-inp" id="cdEditAdminName" type="text" value="${escHtml(ad.display_name || "")}" /></dd></div>
          <div class="sa-dl-row"><dt class="sa-dt">Email</dt><dd class="sa-dd"><input class="sa-info-inp" id="cdEditAdminEmail" type="email" value="${escHtml(ad.email || "")}" /></dd></div>
          <div class="sa-dl-row"><dt class="sa-dt">Teléfono</dt><dd class="sa-dd"><input class="sa-info-inp" id="cdEditAdminPhone" type="tel" value="${escHtml(ad.phone || "")}" placeholder="+34 600 000 000" /></dd></div>
        </dl>
      </div>
    </div>`;
}

function buildPeopleRow() {
  return `
    <div class="sa-two">
      <section class="sa-panel">
        <div class="sa-panel-head"><div><h2 class="sa-panel-title">Últimos alumnos</h2></div></div>
        <div class="sa-mini-list" id="cdStudentsBody"><div class="sa-mini-empty">Cargando…</div></div>
      </section>
      <section class="sa-panel">
        <div class="sa-panel-head"><div><h2 class="sa-panel-title">Docentes</h2></div></div>
        <div class="sa-mini-list" id="cdTeachersBody"><div class="sa-mini-empty">Cargando…</div></div>
      </section>
    </div>`;
}

function buildDangerZone(t) {
  const status = t.status || "active";
  const STATUS_LABELS2 = { active: "Activo", trial: "Prueba", inactive: "Pausado" };
  const opt = v => `<option value="${v}"${status === v ? " selected" : ""}>${STATUS_LABELS2[v]}</option>`;
  return `
    <section class="sa-panel">
      <div class="sa-panel-head">
        <div><h2 class="sa-panel-title" style="color:rgba(242,237,229,0.55)">Zona de administración</h2></div>
      </div>
      <div class="sa-panel-divider"></div>
      <div class="sa-danger-zone">
        <div class="sa-admin-left">
          <span class="sa-dt" style="margin-right:4px">Estado</span>
          <select class="sa-state-select" id="cdStatusSelect">
            ${opt("active")}${opt("trial")}${opt("inactive")}
          </select>
          <button class="sa-btn-save" type="button" id="cdStatusSaveBtn">Guardar</button>
        </div>
        <button class="sa-btn-danger" type="button" id="cdDeleteBtn">Mover a papelera</button>
      </div>
    </section>`;
}

// ── Toast ──────────────────────────────────────────────────────────────────
function showToast(msg) {
  let el = document.getElementById("cdToast");
  if (!el) {
    el = Object.assign(document.createElement("div"), { id: "cdToast", className: "cd-toast" });
    document.body.appendChild(el);
  }
  el.textContent = msg;
  el.classList.add("cd-toast-visible");
  clearTimeout(el._t);
  el._t = setTimeout(() => el.classList.remove("cd-toast-visible"), 2500);
}

// ── PATCH helpers ──────────────────────────────────────────────────────────
async function patchTenant(slug, data) {
  try {
    const res = await apiFetch(`/api/v1/superadmin/tenants/${encodeURIComponent(slug)}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data),
    });
    if (res.status === 404 || res.status === 405) { showToast("Función no disponible aún"); return false; }
    if (!res.ok) { showToast("Error al guardar"); return false; }
    return true;
  } catch { showToast("Error de red"); return false; }
}

async function patchAdmin(slug, data) {
  try {
    const res = await apiFetch(`/api/v1/superadmin/tenants/${encodeURIComponent(slug)}/admin`, {
      method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data),
    });
    if (res.status === 404) { showToast("No hay administrador activo en este centro"); return false; }
    if (!res.ok) { showToast("Error al guardar"); return false; }
    return true;
  } catch { showToast("Error de red"); return false; }
}

// ── Info panel: wire ───────────────────────────────────────────────────────
async function wireInfoPanel(tenant) {
  const inner = document.getElementById("cdInfoInner");
  const panel = document.getElementById("cdInfoPanel");
  const t     = { ...tenant };
  const ad    = { display_name: null, email: null, phone: null };

  try {
    const res = await apiFetch(`/api/v1/superadmin/tenants/${encodeURIComponent(t.slug)}/admin`);
    if (res.ok) {
      const body = await res.json().catch(() => ({}));
      Object.assign(ad, body?.data || {});
    }
  } catch {}

  function showRead() {
    if (panel) {
      const editBtn = panel.querySelector("#cdEditBtn");
      if (editBtn) editBtn.style.display = "";
    }
    if (inner) inner.innerHTML = renderInfoRead(t, ad);
  }

  function showEdit() {
    if (panel) {
      const editBtn = panel.querySelector("#cdEditBtn");
      if (editBtn) editBtn.style.display = "none";
    }
    if (inner) inner.innerHTML = renderInfoEdit(t, ad);
    document.getElementById("cdCancelBtn")?.addEventListener("click", showRead);
    document.getElementById("cdSaveBtn")?.addEventListener("click", handleSave);
  }

  async function handleSave() {
    const saveBtn = document.getElementById("cdSaveBtn");
    saveBtn.disabled = true; saveBtn.textContent = "Guardando…";

    const newName   = document.getElementById("cdEditName")?.value.trim() || t.name;
    const newType   = document.getElementById("cdEditType")?.value;
    const newAName  = document.getElementById("cdEditAdminName")?.value.trim();
    const newAEmail = document.getElementById("cdEditAdminEmail")?.value.trim();
    const newAPhone = document.getElementById("cdEditAdminPhone")?.value.trim();

    const tenantPatch = {};
    if (newName !== t.name)         tenantPatch.name = newName;
    if (newType !== (t.type || "")) tenantPatch.type = newType;

    const adminPatch = {};
    if (newAName  !== (ad.display_name || "")) adminPatch.display_name = newAName;
    if (newAEmail !== (ad.email || ""))        adminPatch.email = newAEmail;
    if (newAPhone !== (ad.phone || ""))        adminPatch.phone = newAPhone;

    let allOk = true;
    if (Object.keys(tenantPatch).length) {
      const ok = await patchTenant(t.slug, tenantPatch);
      if (ok) Object.assign(t, tenantPatch); else allOk = false;
    }
    if (allOk && Object.keys(adminPatch).length) {
      const ok = await patchAdmin(t.slug, adminPatch);
      if (ok) Object.assign(ad, adminPatch); else allOk = false;
    }
    if (allOk) {
      const h = document.getElementById("cdHeaderName");
      if (h) h.textContent = t.name;
      showToast("Cambios guardados");
      showRead();
    } else {
      saveBtn.disabled = false; saveBtn.textContent = "Guardar";
    }
  }

  panel?.querySelector("#cdEditBtn")?.addEventListener("click", showEdit);
  showRead();
}

// ── People ─────────────────────────────────────────────────────────────────
async function loadPeople(slug) {
  const [studRes, teachRes] = await Promise.allSettled([
    apiFetch(`/api/v1/superadmin/tenants/${encodeURIComponent(slug)}/students`),
    apiFetch(`/api/v1/superadmin/tenants/${encodeURIComponent(slug)}/teachers`),
  ]);
  let students = [], teachers = [];
  if (studRes.status === "fulfilled" && studRes.value.ok) {
    const d = await studRes.value.json().catch(() => ({}));
    students = d?.data?.items || [];
  }
  if (teachRes.status === "fulfilled" && teachRes.value.ok) {
    const d = await teachRes.value.json().catch(() => ({}));
    teachers = d?.data?.items || [];
  }

  const set = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };
  set("cdKpiAlumnos",  students.length || "—");
  set("cdKpiDocentes", teachers.length || "—");

  const sBody = document.getElementById("cdStudentsBody");
  if (sBody) sBody.innerHTML = students.slice(0, 5).length
    ? students.slice(0, 5).map(s => {
        const init = (s.display_name || s.email || "?")[0].toUpperCase();
        return `<div class="sa-mini-row">
          <div class="sa-mini-av">${escHtml(init)}</div>
          <div class="sa-mini-info">
            <span class="sa-mini-name">${escHtml(s.display_name || s.email || "—")}</span>
            <span class="sa-mini-sub">${relativeDate(s.last_seen || s.created_at)}</span>
          </div>
        </div>`;
      }).join("")
    : `<div class="sa-mini-empty">Sin alumnos aún</div>`;

  const tBody = document.getElementById("cdTeachersBody");
  if (tBody) tBody.innerHTML = teachers.length
    ? teachers.map(t => {
        const init = (t.display_name || t.email || "?")[0].toUpperCase();
        return `<div class="sa-mini-row">
          <div class="sa-mini-av sa-mini-av--teacher">${escHtml(init)}</div>
          <div class="sa-mini-info">
            <span class="sa-mini-name">
              ${escHtml(t.display_name || "—")}
              ${t.is_admin ? `<span class="sa-mini-badge">Admin</span>` : ""}
            </span>
            <span class="sa-mini-sub">${escHtml(t.email || "—")}</span>
          </div>
          <span class="sa-mini-tag">${t.subjects_count ? `${t.subjects_count} materias` : ""}</span>
        </div>`;
      }).join("")
    : `<div class="sa-mini-empty">Sin docentes aún</div>`;
}

// ── Event wiring ───────────────────────────────────────────────────────────
function wireEvents(tenant, onBack) {
  document.getElementById("cdBackBtn")?.addEventListener("click", () => onBack?.());

  document.getElementById("cdAdminBtn")?.addEventListener("click", async e => {
    const btn = e.currentTarget;
    const orig = btn.textContent;
    btn.disabled = true; btn.textContent = "Generando enlace…";
    try {
      const res  = await apiFetch(`/api/v1/superadmin/tenants/${encodeURIComponent(tenant.slug)}/impersonate`, { method: "POST" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.data?.url) { alert(data?.error?.message || "No se pudo generar el enlace."); return; }
      window.open(data.data.url, "_blank");
    } catch { alert("Error de red."); }
    finally { btn.disabled = false; btn.textContent = orig; }
  });

  const saveBtn = document.getElementById("cdStatusSaveBtn");
  saveBtn?.addEventListener("click", async () => {
    const sel = document.getElementById("cdStatusSelect");
    saveBtn.disabled = true; saveBtn.textContent = "Guardando…";
    const ok = await patchTenant(tenant.slug, { status: sel?.value });
    if (ok) {
      saveBtn.textContent = "¡Guardado!";
      setTimeout(() => { saveBtn.textContent = "Guardar"; saveBtn.disabled = false; }, 1500);
    } else {
      saveBtn.disabled = false; saveBtn.textContent = "Guardar";
    }
  });

  document.getElementById("cdDeleteBtn")?.addEventListener("click", () => {
    openDeleteModal(tenant, () => onBack?.());
  });
}

// ── Factory ────────────────────────────────────────────────────────────────
export function createCentroDetalleView(panelEl) {
  return {
    show(tenant, onBack) {
      panelEl.innerHTML =
        buildHead(tenant, onBack) +
        buildKPIs() +
        buildInfoPanel(tenant) +
        buildPeopleRow() +
        buildDangerZone(tenant);

      wireEvents(tenant, onBack);
      wireInfoPanel(tenant);
      loadPeople(tenant.slug);
    },
    hide() {
      panelEl.innerHTML = "";
    },
  };
}
