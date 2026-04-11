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
function fieldRow(label, inpId, type, value, readonly = false) {
  const v  = value && value !== "—" ? escHtml(value) : "";
  const ph = value && value !== "—" ? escHtml(value) : "Sin datos";
  return `
    <div class="cd-field-row">
      <span class="cd-field-label">${label}</span>
      <div class="cd-field-edit-wrap">
        <input class="cd-field-inp${readonly ? " cd-field-readonly" : ""}"
               id="${inpId}" type="${type}" value="${v}" placeholder="${ph}"
               ${readonly ? "readonly" : ""} />
        ${readonly ? "" : `<button class="cd-save-btn" id="${inpId}Btn" type="button" hidden>Guardar</button>`}
      </div>
    </div>`;
}

function typeSelectRow(t) {
  const opts = `<option value="">Sin especificar</option>` +
    TYPE_OPTS.map(v =>
      `<option value="${v}"${t.type === v ? " selected" : ""}>${TYPE_LABELS[v]}</option>`
    ).join("");
  return `
    <div class="cd-field-row">
      <span class="cd-field-label">Tipo de centro</span>
      <div class="cd-field-edit-wrap">
        <select class="cd-field-inp cd-field-sel" id="cdInpType">${opts}</select>
        <button class="cd-save-btn" id="cdInpTypeBtn" type="button" hidden>Guardar</button>
      </div>
    </div>`;
}

// Sección 1 — cabecera (nombre editable, badges, botón admin)
function buildHeaderTop(t) {
  const status = t.status || "active";
  return `
    <div class="cd-header-card table-card">
      <div class="cd-header-top">
        <div class="cd-header-left">
          <div class="cd-name-row">
            <input class="cd-field-inp cd-name-inp" id="cdInpName" type="text"
                   value="${escHtml(t.name)}" placeholder="Nombre del centro" />
            <button class="cd-save-btn" id="cdInpNameBtn" type="button" hidden>Guardar</button>
          </div>
          <div class="cd-header-badges">
            <span class="badge ${status}">${STATUS_LABELS[status] || status}</span>
            <code class="cd-slug">${escHtml(t.slug)}</code>
          </div>
        </div>
        <button class="btn-primary cd-admin-btn" id="cdAdminBtn" type="button">Entrar como admin →</button>
      </div>
    </div>`;
}

// Sección 3 — grid de datos editables (datos del centro / admin / info)
function buildFieldsGrid(t) {
  return `
    <div class="table-card">
      <div class="cd-fields-grid">
        <div class="cd-fields-group">
          <div class="cd-fields-group-title">Datos del centro</div>
          ${typeSelectRow(t)}
        </div>
        <div class="cd-fields-group">
          <div class="cd-fields-group-title">Administrador del centro</div>
          ${fieldRow("Nombre completo", "cdInpAdminName",  "text",  null)}
          ${fieldRow("Email del admin", "cdInpAdminEmail", "email", null)}
          ${/* TODO: mostrar campo teléfono del admin — falta añadirlo aquí y cargarlo desde GET /admin */""}

        </div>
        <div class="cd-fields-group">
          <div class="cd-fields-group-title">Información</div>
          <div class="cd-field-row">
            <span class="cd-field-label">Slug</span>
            <code class="cd-slug">${escHtml(t.slug)}</code>
          </div>
          <div class="cd-field-row">
            <span class="cd-field-label">Creado</span>
            <span class="cd-field-val">${fmtDate(t.created_at)}</span>
          </div>
        </div>
      </div>
    </div>`;
}

// Sección 2 — KPIs
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

// ── Edición siempre visible ────────────────────────────────────────────────
// Devuelve { reset(v) } para poder actualizar el valor y el "original" desde fuera
function makeAlwaysEditable(inpId, onSave) {
  const inp = document.getElementById(inpId);
  if (!inp) return { reset: () => {} };

  const btn   = document.getElementById(`${inpId}Btn`);
  const isSel = inp.tagName === "SELECT";
  let original = inp.value;

  // Si el campo es readonly no tiene botón — solo exponemos reset
  if (!btn) return { reset: (v) => { inp.value = v; original = v; } };

  inp.addEventListener(isSel ? "change" : "input", () => {
    btn.hidden = inp.value === original;
  });

  btn.addEventListener("click", async () => {
    const val = isSel ? inp.value : inp.value.trim();
    btn.disabled = true; btn.textContent = "Guardando…";
    const ok = await onSave(val);
    if (ok) { original = val; } else { inp.value = original; }
    btn.hidden = true; btn.disabled = false; btn.textContent = "Guardar";
  });

  return { reset: (v) => { inp.value = v; original = v; btn.hidden = true; } };
}

function wireInlineEdits(tenant) {
  const slug = tenant.slug;
  makeAlwaysEditable("cdInpName", v => patchTenant(slug, { name: v }));
  makeAlwaysEditable("cdInpType", v => patchTenant(slug, { type: v }));
  const adminName  = makeAlwaysEditable("cdInpAdminName",  v => patchAdmin(slug, { display_name: v }));
  const adminEmail = makeAlwaysEditable("cdInpAdminEmail", v => patchAdmin(slug, { email: v }));
  return { resetAdminName: adminName.reset, resetAdminEmail: adminEmail.reset };
}

// ── Carga de datos del admin ───────────────────────────────────────────────
async function loadAdminData(slug, edits) {
  try {
    const res = await apiFetch(`/api/v1/superadmin/tenants/${encodeURIComponent(slug)}/admin`);
    if (!res.ok) return;
    const d = await res.json().catch(() => ({}));
    const a = d?.data || {};
    if (a.display_name) edits.resetAdminName(a.display_name);
    if (a.email) {
      edits.resetAdminEmail(a.email);
      // El email ya existe → marcar como readonly
      const inp = document.getElementById("cdInpAdminEmail");
      const btn = document.getElementById("cdInpAdminEmailBtn");
      if (inp) { inp.readOnly = true; inp.classList.add("cd-field-readonly"); }
      if (btn) btn.hidden = true;
    }
  } catch {}
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

// ── Eventos ────────────────────────────────────────────────────────────────
function wireDetailEvents(tenant, onBack) {
  const edits = wireInlineEdits(tenant);

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

  return edits;
}

// ── Fábrica del módulo ─────────────────────────────────────────────────────
export function createCentroDetalleView(panelEl) {
  let savedFragment = null;

  return {
    show(tenant, onBack) {
      savedFragment = document.createDocumentFragment();
      while (panelEl.firstChild) savedFragment.appendChild(panelEl.firstChild);

      // Orden correcto: cabecera → KPIs → datos editables → personas → danger zone
      panelEl.innerHTML =
        buildHeaderTop(tenant) +
        buildKPIs() +
        buildFieldsGrid(tenant) +
        `<div class="cd-row2">${buildStudentsCard()}${buildTeachersCard()}</div>` +
        buildDangerZone(tenant);

      const edits = wireDetailEvents(tenant, onBack);
      loadAdminData(tenant.slug, edits);      // carga y rellena campos admin
      loadAndRenderPeople(tenant.slug);       // carga KPIs + listas
    },

    hide() {
      if (!savedFragment) return;
      panelEl.innerHTML = "";
      panelEl.appendChild(savedFragment);
      savedFragment = null;
    },
  };
}
