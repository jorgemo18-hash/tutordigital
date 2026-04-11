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
  if (d < 30)  return `hace ${d} días`;
  if (d < 365) return `hace ${Math.floor(d / 30)} meses`;
  return `hace ${Math.floor(d / 365)} años`;
}

function fmtDate(iso) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("es-ES", { day: "numeric", month: "long", year: "numeric" });
}

const STATUS_LABELS = { active: "Activo", trial: "Prueba", inactive: "Inactivo" };
const TYPE_LABELS   = { academia: "Academia", instituto: "Instituto", colegio: "Colegio", otro: "Otro" };
const TYPE_OPTS     = ["academia", "instituto", "colegio", "otro"];

// ── HTML builders ──────────────────────────────────────────────────────────

// Header card — nombre destacado, badge de estado, slug, botón "Entrar como admin"
function buildHeaderTop(t) {
  const status = t.status || "active";
  return `
    <div class="cd-header-card table-card">
      <div class="cd-header-top">
        <div class="cd-header-left">
          <h2 class="cd-header-name" id="cdHeaderName">${escHtml(t.name)}</h2>
          <div class="cd-header-badges">
            <span class="badge ${status}">${STATUS_LABELS[status] || status}</span>
            <code class="cd-slug">${escHtml(t.slug)}</code>
          </div>
        </div>
        <button class="btn-primary cd-admin-btn" id="cdAdminBtn" type="button">Entrar como admin →</button>
      </div>
    </div>`;
}

// Info card — contenedor vacío rellenado por wireInfoCard
function buildInfoCard() {
  return `<div class="table-card cd-info-card"><div id="cdInfoInner"></div></div>`;
}

// Info card — modo lectura
function renderInfoRead(t, ad) {
  return `
    <div class="cd-info-header">
      <span class="cd-info-title">Información del centro</span>
      <button class="cd-edit-btn" id="cdEditBtn" type="button">Editar</button>
    </div>
    <div class="cd-info-section-label">Datos del centro</div>
    <div class="cd-info-grid">
      <span class="cd-info-label">Nombre</span>
      <span class="cd-info-value">${escHtml(t.name)}</span>
      <span class="cd-info-label">Tipo</span>
      <span class="cd-info-value">${TYPE_LABELS[t.type] || "—"}</span>
      <span class="cd-info-label">Slug</span>
      <code class="cd-info-value cd-slug">${escHtml(t.slug)}</code>
      <span class="cd-info-label">Creado</span>
      <span class="cd-info-value">${fmtDate(t.created_at)}</span>
    </div>
    <div class="cd-info-sep"></div>
    <div class="cd-info-section-label">Administrador del centro</div>
    <div class="cd-info-grid">
      <span class="cd-info-label">Nombre</span>
      <span class="cd-info-value">${escHtml(ad.display_name || "—")}</span>
      <span class="cd-info-label">Email</span>
      <span class="cd-info-value">${escHtml(ad.email || "—")}</span>
      <span class="cd-info-label">Teléfono</span>
      <span class="cd-info-value">${escHtml(ad.phone || "—")}</span>
    </div>`;
}

// Info card — modo edición
function renderInfoEdit(t, ad) {
  const typeOpts = `<option value="">Sin especificar</option>` +
    TYPE_OPTS.map(v =>
      `<option value="${v}"${t.type === v ? " selected" : ""}>${TYPE_LABELS[v]}</option>`
    ).join("");
  return `
    <div class="cd-info-header">
      <span class="cd-info-title">Información del centro</span>
      <div class="cd-info-actions">
        <button class="cd-cancel-btn" id="cdCancelBtn" type="button">Cancelar</button>
        <button class="cd-save-all-btn" id="cdSaveBtn" type="button">Guardar</button>
      </div>
    </div>
    <div class="cd-info-section-label">Datos del centro</div>
    <div class="cd-info-grid">
      <span class="cd-info-label">Nombre</span>
      <input class="cd-info-inp" id="cdEditName" type="text" value="${escHtml(t.name)}" />
      <span class="cd-info-label">Tipo</span>
      <select class="cd-info-inp cd-info-sel" id="cdEditType">${typeOpts}</select>
      <span class="cd-info-label">Slug</span>
      <code class="cd-info-value cd-slug">${escHtml(t.slug)}</code>
      <span class="cd-info-label">Creado</span>
      <span class="cd-info-value">${fmtDate(t.created_at)}</span>
    </div>
    <div class="cd-info-sep"></div>
    <div class="cd-info-section-label">Administrador del centro</div>
    <div class="cd-info-grid">
      <span class="cd-info-label">Nombre</span>
      <input class="cd-info-inp" id="cdEditAdminName" type="text"
             value="${escHtml(ad.display_name || '')}" />
      <span class="cd-info-label">Email</span>
      <input class="cd-info-inp" id="cdEditAdminEmail" type="email"
             value="${escHtml(ad.email || '')}" />
      <span class="cd-info-label">Teléfono</span>
      <input class="cd-info-inp" id="cdEditAdminPhone" type="tel"
             value="${escHtml(ad.phone || '')}" placeholder="+34 600 000 000" />
    </div>`;
}

// KPIs
function buildKPIs() {
  const kpis = [
    { id: "cdKpiAlumnos",  label: "Alumnos" },
    { id: "cdKpiDocentes", label: "Docentes" },
    { id: "cdKpiGrupos",   label: "Grupos" },
    { id: "cdKpiSesiones", label: "Sesiones este mes" },
  ];
  return `<div class="metrics">${kpis.map(k => `
    <div class="metric-card">
      <div class="metric-label">${k.label}</div>
      <div class="metric-value es-kpi-neutral" id="${k.id}">—</div>
    </div>`).join("")}
  </div>`;
}

function buildStudentsCard() {
  return `
    <div class="table-card">
      <div class="table-header"><span class="table-title">Últimos alumnos</span></div>
      <div class="cd-people-body" id="cdStudentsBody"><div class="cd-empty">Cargando…</div></div>
    </div>`;
}

function buildTeachersCard() {
  return `
    <div class="table-card">
      <div class="table-header"><span class="table-title">Docentes</span></div>
      <div class="cd-people-body" id="cdTeachersBody"><div class="cd-empty">Cargando…</div></div>
    </div>`;
}

function buildDangerZone(t) {
  const status = t.status || "active";
  const opt    = (v) => `<option value="${v}"${status === v ? " selected" : ""}>${STATUS_LABELS[v]}</option>`;
  return `
    <div class="table-card cd-danger-card">
      <div class="table-header"><span class="table-title cd-danger-title">Zona de administración</span></div>
      <div class="cd-danger-row">
        <div class="cd-danger-left">
          <span class="cd-danger-label">Estado</span>
          <select class="es-tenant-select" id="cdStatusSelect">
            ${opt("active")}${opt("trial")}${opt("inactive")}
          </select>
          <button class="btn-primary" type="button" id="cdStatusSaveBtn">Guardar</button>
        </div>
        <button class="cd-delete-btn" type="button" id="cdDeleteBtn">Eliminar centro</button>
      </div>
    </div>`;
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

// ── Info card — carga datos del admin y gestiona modo lectura/edición ──────
async function wireInfoCard(tenant) {
  const inner = document.getElementById("cdInfoInner");
  const t  = { ...tenant };
  const ad = { display_name: null, email: null, phone: null };

  try {
    const res = await apiFetch(`/api/v1/superadmin/tenants/${encodeURIComponent(t.slug)}/admin`);
    if (res.ok) {
      const body = await res.json().catch(() => ({}));
      Object.assign(ad, body?.data || {});
    }
  } catch {}

  function showRead() {
    inner.innerHTML = renderInfoRead(t, ad);
    document.getElementById("cdEditBtn").addEventListener("click", showEdit);
  }

  function showEdit() {
    inner.innerHTML = renderInfoEdit(t, ad);
    document.getElementById("cdCancelBtn").addEventListener("click", showRead);
    document.getElementById("cdSaveBtn").addEventListener("click", handleSave);
  }

  async function handleSave() {
    const saveBtn = document.getElementById("cdSaveBtn");
    saveBtn.disabled = true;
    saveBtn.textContent = "Guardando…";

    const newName  = document.getElementById("cdEditName")?.value.trim() || t.name;
    const newType  = document.getElementById("cdEditType")?.value;
    const newAName = document.getElementById("cdEditAdminName")?.value.trim();
    const newAEmail = document.getElementById("cdEditAdminEmail")?.value.trim();
    const newAPhone = document.getElementById("cdEditAdminPhone")?.value.trim();

    const tenantPatch = {};
    if (newName !== t.name) tenantPatch.name = newName;
    if (newType !== (t.type || "")) tenantPatch.type = newType;

    const adminPatch = {};
    if (newAName !== (ad.display_name || "")) adminPatch.display_name = newAName;
    if (newAEmail !== (ad.email || "")) adminPatch.email = newAEmail;
    if (newAPhone !== (ad.phone || "")) adminPatch.phone = newAPhone;

    let allOk = true;

    if (Object.keys(tenantPatch).length) {
      const ok = await patchTenant(t.slug, tenantPatch);
      if (ok) Object.assign(t, tenantPatch);
      else allOk = false;
    }

    if (allOk && Object.keys(adminPatch).length) {
      const ok = await patchAdmin(t.slug, adminPatch);
      if (ok) Object.assign(ad, adminPatch);
      else allOk = false;
    }

    if (allOk) {
      const headerName = document.getElementById("cdHeaderName");
      if (headerName) headerName.textContent = t.name;
      showToast("Cambios guardados");
      showRead();
    } else {
      saveBtn.disabled = false;
      saveBtn.textContent = "Guardar";
    }
  }

  showRead();
}

// ── Carga de alumnos/docentes ──────────────────────────────────────────────
async function loadTenantData(slug) {
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
  return { students, teachers };
}

function studentRow(s) {
  const init = (s.display_name || s.email || "?")[0].toUpperCase();
  return `<div class="cd-person-row">
    <div class="cd-avatar">${escHtml(init)}</div>
    <div class="cd-person-info">
      <div class="cd-person-name">${escHtml(s.display_name || s.email || "—")}</div>
      <div class="cd-person-sub">${relativeDate(s.last_seen || s.created_at)}</div>
    </div></div>`;
}

function teacherRow(t) {
  const init = (t.display_name || t.email || "?")[0].toUpperCase();
  return `<div class="cd-person-row">
    <div class="cd-avatar cd-avatar-teacher">${escHtml(init)}</div>
    <div class="cd-person-info">
      <div class="cd-person-name">
        ${escHtml(t.display_name || "—")}
        ${t.is_admin ? `<span class="badge active cd-admin-badge">Admin</span>` : ""}
      </div>
      <div class="cd-person-sub">${escHtml(t.email || "—")}</div>
    </div></div>`;
}

async function loadAndRenderPeople(slug) {
  const { students, teachers } = await loadTenantData(slug);
  const set = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };
  set("cdKpiAlumnos",  students.length || "—");
  set("cdKpiDocentes", teachers.length || "—");

  const sBody = document.getElementById("cdStudentsBody");
  if (sBody) sBody.innerHTML = students.slice(0, 5).length
    ? students.slice(0, 5).map(studentRow).join("")
    : `<div class="cd-empty">Sin alumnos aún</div>`;

  const tBody = document.getElementById("cdTeachersBody");
  if (tBody) tBody.innerHTML = teachers.length
    ? teachers.map(teacherRow).join("")
    : `<div class="cd-empty">Sin docentes aún</div>`;
}

// ── Eventos del header y zona de administración ────────────────────────────
function wireDetailEvents(tenant, onBack) {
  document.getElementById("cdAdminBtn")?.addEventListener("click", async (e) => {
    const btn = e.currentTarget;
    const original = btn.textContent;
    btn.disabled = true;
    btn.textContent = "Generando enlace…";
    try {
      const res = await apiFetch(`/api/v1/superadmin/tenants/${encodeURIComponent(tenant.slug)}/impersonate`, { method: "POST" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.data?.url) {
        alert(data?.error?.message || "No se pudo generar el enlace de impersonación.");
        return;
      }
      window.open(data.data.url, "_blank");
    } catch {
      alert("Error de red al generar el enlace.");
    } finally {
      btn.disabled = false;
      btn.textContent = original;
    }
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

// ── Fábrica del módulo ─────────────────────────────────────────────────────
export function createCentroDetalleView(panelEl) {
  let savedFragment = null;

  return {
    show(tenant, onBack) {
      savedFragment = document.createDocumentFragment();
      while (panelEl.firstChild) savedFragment.appendChild(panelEl.firstChild);

      panelEl.innerHTML =
        buildHeaderTop(tenant) +
        buildKPIs() +
        buildInfoCard() +
        `<div class="cd-row2">${buildStudentsCard()}${buildTeachersCard()}</div>` +
        buildDangerZone(tenant);

      wireDetailEvents(tenant, onBack);
      wireInfoCard(tenant);         // async: carga datos admin → muestra modo lectura
      loadAndRenderPeople(tenant.slug);
    },

    hide() {
      if (!savedFragment) return;
      panelEl.innerHTML = "";
      panelEl.appendChild(savedFragment);
      savedFragment = null;
    },
  };
}
