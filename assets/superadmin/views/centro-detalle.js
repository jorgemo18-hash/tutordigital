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
const STATUS_CLS    = { active: "activo", trial: "prueba", inactive: "inactivo" };

const TYPE_LABELS = {
  academia:            "Academia",
  instituto_integrado: "Instituto integrado",
  standalone:          "Stand-alone",
};
const TYPE_OPTS = ["academia", "instituto_integrado", "standalone"];

// ── HTML builders ──────────────────────────────────────────────────────────

function buildHead(t) {
  const status = t.status || "active";
  const cls    = STATUS_CLS[status] || "inactivo";
  return `
    <div class="sa-head">
      <div>
        <button class="sa-back-btn" id="cdBackBtn" type="button">← Volver</button>
        <div class="sa-head-meta">
          <h1 class="sa-head-title" id="cdHeaderName">${escHtml(t.name)}</h1>
          <div class="sa-head-badges">
            <span class="sa-estado ${cls}" id="cdHeaderBadge">${STATUS_LABELS[status] || status}</span>
            <code class="sa-hero-slug">${escHtml(t.slug)}</code>
          </div>
        </div>
      </div>
      <div class="sa-head-right">
        <button class="sa-btn-impersonate" id="cdAdminBtn" type="button">Entrar como admin →</button>
      </div>
    </div>`;
}

function buildKPIs() {
  const kpis = [
    { id: "cdKpiAlumnos",  label: "Alumnos" },
    { id: "cdKpiDocentes", label: "Docentes" },
    { id: "cdKpiGrupos",   label: "Grupos" },
    { id: "cdKpiSesiones", label: "Sesiones este mes" },
  ];
  return `
    <div class="sa-metrics">
      ${kpis.map(k => `
        <div class="sa-metric">
          <div class="sa-metric-label">${k.label}</div>
          <div class="sa-metric-value sa-metric-value--neutral" id="${k.id}">—</div>
        </div>`).join("")}
    </div>`;
}

function buildInfoCard() {
  return `<div class="sa-card" id="cdInfoCard"><div id="cdInfoInner"></div></div>`;
}

// Info card — modo lectura
function renderInfoRead(t, ad) {
  const typeLabel = TYPE_LABELS[t.type] || "—";
  return `
    <div class="sa-info-head">
      <span class="sa-info-title">Información del centro</span>
      <button class="sa-btn-edit" id="cdEditBtn" type="button">Editar</button>
    </div>
    <div class="sa-info-cols">
      <div class="sa-info-col">
        <div class="sa-info-section">Datos del centro</div>
        <div class="sa-info-grid">
          <span class="sa-dl-label">Nombre</span>
          <span class="sa-dl-value">${escHtml(t.name)}</span>
          <span class="sa-dl-label">Tipo</span>
          <span class="sa-dl-value">${typeLabel}</span>
          <span class="sa-dl-label">Slug</span>
          <code class="sa-dl-value sa-dl-mono">${escHtml(t.slug)}</code>
          <span class="sa-dl-label">Creado</span>
          <span class="sa-dl-value">${fmtDate(t.created_at)}</span>
        </div>
      </div>
      <div class="sa-info-col">
        <div class="sa-info-section">Administrador del centro</div>
        <div class="sa-info-grid">
          <span class="sa-dl-label">Nombre</span>
          <span class="sa-dl-value">${escHtml(ad.display_name || "—")}</span>
          <span class="sa-dl-label">Email</span>
          <span class="sa-dl-value">${escHtml(ad.email || "—")}</span>
          <span class="sa-dl-label">Teléfono</span>
          <span class="sa-dl-value">${escHtml(ad.phone || "—")}</span>
        </div>
      </div>
    </div>`;
}

// Info card — modo edición
function renderInfoEdit(t, ad) {
  const typeOpts = `<option value="">Sin especificar</option>` +
    TYPE_OPTS.map(v => `<option value="${v}"${t.type === v ? " selected" : ""}>${TYPE_LABELS[v]}</option>`).join("");
  return `
    <div class="sa-info-head">
      <span class="sa-info-title">Información del centro</span>
      <div class="sa-info-actions">
        <button class="sa-btn-cancel" id="cdCancelBtn" type="button">Cancelar</button>
        <button class="sa-btn-save" id="cdSaveBtn" type="button">Guardar</button>
      </div>
    </div>
    <div class="sa-info-cols">
      <div class="sa-info-col">
        <div class="sa-info-section">Datos del centro</div>
        <div class="sa-info-grid">
          <span class="sa-dl-label">Nombre</span>
          <input class="sa-info-inp" id="cdEditName" type="text" value="${escHtml(t.name)}" />
          <span class="sa-dl-label">Tipo</span>
          <select class="sa-info-inp sa-info-sel" id="cdEditType">${typeOpts}</select>
          <span class="sa-dl-label">Slug</span>
          <code class="sa-dl-value sa-dl-mono">${escHtml(t.slug)}</code>
          <span class="sa-dl-label">Creado</span>
          <span class="sa-dl-value">${fmtDate(t.created_at)}</span>
        </div>
      </div>
      <div class="sa-info-col">
        <div class="sa-info-section">Administrador del centro</div>
        <div class="sa-info-grid">
          <span class="sa-dl-label">Nombre</span>
          <input class="sa-info-inp" id="cdEditAdminName" type="text" value="${escHtml(ad.display_name || '')}" />
          <span class="sa-dl-label">Email</span>
          <input class="sa-info-inp" id="cdEditAdminEmail" type="email" value="${escHtml(ad.email || '')}" />
          <span class="sa-dl-label">Teléfono</span>
          <input class="sa-info-inp" id="cdEditAdminPhone" type="tel" value="${escHtml(ad.phone || '')}" placeholder="+34 600 000 000" />
        </div>
      </div>
    </div>`;
}

function buildStudentsCard() {
  return `
    <div class="sa-card" style="margin-bottom:0">
      <div class="sa-card-head"><span class="sa-card-title">Últimos alumnos</span></div>
      <div class="sa-mini-list" id="cdStudentsBody"><div class="sa-mini-empty">Cargando…</div></div>
    </div>`;
}

function buildTeachersCard() {
  return `
    <div class="sa-card" style="margin-bottom:0">
      <div class="sa-card-head"><span class="sa-card-title">Docentes</span></div>
      <div class="sa-mini-list" id="cdTeachersBody"><div class="sa-mini-empty">Cargando…</div></div>
    </div>`;
}

function buildDangerZone(t) {
  const status = t.status || "active";
  const opt = v => `<option value="${v}"${status === v ? " selected" : ""}>${STATUS_LABELS[v]}</option>`;
  return `
    <div class="sa-card">
      <div class="sa-card-head">
        <span class="sa-card-title sa-danger-title">Zona de administración</span>
      </div>
      <div class="sa-danger-row">
        <div class="sa-danger-left">
          <span class="sa-danger-label">Estado</span>
          <select class="es-tenant-select" id="cdStatusSelect">
            ${opt("active")}${opt("trial")}${opt("inactive")}
          </select>
          <button class="sa-btn-save" type="button" id="cdStatusSaveBtn">Guardar</button>
        </div>
        <button class="sa-btn-danger" type="button" id="cdDeleteBtn">Mover a papelera</button>
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

// ── Info card: carga admin y gestiona lectura/edición ─────────────────────
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

// ── Personas ──────────────────────────────────────────────────────────────
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
  return `
    <div class="sa-mini-row">
      <div class="sa-mini-av">${escHtml(init)}</div>
      <div class="sa-mini-info">
        <div class="sa-mini-name">${escHtml(s.display_name || s.email || "—")}</div>
        <div class="sa-mini-sub">${relativeDate(s.last_seen || s.created_at)}</div>
      </div>
    </div>`;
}

function teacherRow(t) {
  const init = (t.display_name || t.email || "?")[0].toUpperCase();
  return `
    <div class="sa-mini-row">
      <div class="sa-mini-av sa-mini-av--teacher">${escHtml(init)}</div>
      <div class="sa-mini-info">
        <div class="sa-mini-name">
          ${escHtml(t.display_name || "—")}
          ${t.is_admin ? `<span class="sa-mini-badge">Admin</span>` : ""}
        </div>
        <div class="sa-mini-sub">${escHtml(t.email || "—")}</div>
      </div>
    </div>`;
}

async function loadAndRenderPeople(slug) {
  const { students, teachers } = await loadTenantData(slug);
  const set = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };
  set("cdKpiAlumnos",  students.length || "—");
  set("cdKpiDocentes", teachers.length || "—");

  const sBody = document.getElementById("cdStudentsBody");
  if (sBody) sBody.innerHTML = students.slice(0, 5).length
    ? students.slice(0, 5).map(studentRow).join("")
    : `<div class="sa-mini-empty">Sin alumnos aún</div>`;

  const tBody = document.getElementById("cdTeachersBody");
  if (tBody) tBody.innerHTML = teachers.length
    ? teachers.map(teacherRow).join("")
    : `<div class="sa-mini-empty">Sin docentes aún</div>`;
}

// ── Eventos del header y zona de administración ────────────────────────────
function wireDetailEvents(tenant, onBack) {
  document.getElementById("cdBackBtn")?.addEventListener("click", () => onBack?.());

  document.getElementById("cdAdminBtn")?.addEventListener("click", async e => {
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
  return {
    show(tenant, onBack) {
      panelEl.innerHTML =
        buildHead(tenant) +
        buildKPIs() +
        buildInfoCard() +
        `<div class="sa-row2">${buildStudentsCard()}${buildTeachersCard()}</div>` +
        buildDangerZone(tenant);

      wireDetailEvents(tenant, onBack);
      wireInfoCard(tenant);
      loadAndRenderPeople(tenant.slug);
    },

    hide() {
      panelEl.innerHTML = "";
    },
  };
}
