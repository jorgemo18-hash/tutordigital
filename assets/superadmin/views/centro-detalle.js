import { apiFetch } from "../../shared/js/auth.js";

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
function fieldRow(label, dispId, inpId, type, value) {
  const display = escHtml(value || "—");
  const inpVal  = value && value !== "—" ? escHtml(value) : "";
  return `
    <div class="cd-field-row">
      <span class="cd-field-label">${label}</span>
      <div class="cd-field-val-wrap">
        <span class="cd-field-val" id="${dispId}">${display}</span>
        <input class="cd-field-inp" id="${inpId}" type="${type}" value="${inpVal}" hidden />
        <button class="cd-edit-btn" type="button" aria-label="Editar ${label}">✏</button>
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
      <div class="cd-field-val-wrap">
        <span class="cd-field-val" id="cdDispType">${escHtml(TYPE_LABELS[t.type] || t.type || "—")}</span>
        <select class="cd-field-inp cd-field-sel" id="cdInpType" hidden>${opts}</select>
        <button class="cd-edit-btn" type="button" aria-label="Editar tipo">✏</button>
      </div>
    </div>`;
}

function buildHeader(t) {
  const status = t.status || "active";
  return `
    <div class="cd-header-card table-card">
      <div class="cd-header-top">
        <div class="cd-name-row">
          <span class="cd-header-name" id="cdDispName">${escHtml(t.name)}</span>
          <input class="cd-field-inp cd-name-inp" id="cdInpName" type="text" value="${escHtml(t.name)}" hidden />
          <button class="cd-edit-btn cd-name-edit-btn" type="button" aria-label="Editar nombre">✏</button>
        </div>
        <div class="cd-header-badges">
          <span class="badge ${status}">${STATUS_LABELS[status] || status}</span>
          <code class="cd-slug">${escHtml(t.slug)}</code>
        </div>
        <button class="btn-primary cd-admin-btn" id="cdAdminBtn" type="button">Entrar como admin →</button>
      </div>
      <div class="cd-fields-grid">
        <div class="cd-fields-group">
          <div class="cd-fields-group-title">Datos del centro</div>
          ${fieldRow("Email de contacto", "cdDispEmail", "cdInpEmail", "email", t.email)}
          ${typeSelectRow(t)}
        </div>
        <div class="cd-fields-group">
          <div class="cd-fields-group-title">Administrador del centro</div>
          ${fieldRow("Nombre completo", "cdDispAdminName", "cdInpAdminName", "text", t.admin_name)}
          ${fieldRow("Email del admin", "cdDispAdminEmail", "cdInpAdminEmail", "email", t.admin_email)}
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
  return `
    <div class="table-card cd-danger-card">
      <div class="table-header"><span class="table-title cd-danger-title">Zona de administración</span></div>
      <div class="cd-danger-body">
        <div class="cd-danger-row">
          <div>
            <div class="cd-danger-label">Estado del centro</div>
            <div class="cd-danger-sub">Cambia el estado operativo del centro</div>
          </div>
          <div class="cd-danger-actions">
            <select class="es-tenant-select" id="cdStatusSelect">
              <option value="active"   ${status === "active"   ? "selected" : ""}>Activo</option>
              <option value="trial"    ${status === "trial"    ? "selected" : ""}>Prueba</option>
              <option value="inactive" ${status === "inactive" ? "selected" : ""}>Inactivo</option>
            </select>
            <button class="btn-primary" type="button" id="cdStatusSaveBtn">Guardar</button>
          </div>
        </div>
        <div class="cd-danger-sep"></div>
        <div class="cd-danger-row">
          <div>
            <div class="cd-danger-label cd-danger-red">Eliminar centro</div>
            <div class="cd-danger-sub">Acción irreversible · elimina todos los datos del centro.</div>
          </div>
          <button class="cd-delete-btn" type="button" id="cdDeleteBtn">Eliminar centro</button>
        </div>
      </div>
    </div>`;
}

// ── Toast ──────────────────────────────────────────────────────────────────
function showToast(msg) {
  let el = document.getElementById("cdToast");
  if (!el) {
    el = document.createElement("div");
    el.id = "cdToast";
    el.className = "cd-toast";
    document.body.appendChild(el);
  }
  el.textContent = msg;
  el.classList.add("cd-toast-visible");
  clearTimeout(el._timer);
  el._timer = setTimeout(() => el.classList.remove("cd-toast-visible"), 2500);
}

// ── PATCH helpers ──────────────────────────────────────────────────────────
async function patchTenant(slug, data) {
  try {
    const res = await apiFetch(`/api/v1/superadmin/tenants/${encodeURIComponent(slug)}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (res.status === 404 || res.status === 405) { showToast("Función no disponible aún"); return false; }
    if (!res.ok) { showToast("Error al guardar"); return false; }
    return true;
  } catch { showToast("Error de red"); return false; }
}

// ── Edición inline ─────────────────────────────────────────────────────────
function makeEditable(dispId, inpId, onSave) {
  const disp    = document.getElementById(dispId);
  const inp     = document.getElementById(inpId);
  if (!disp || !inp) return;
  const btn     = disp.parentElement?.querySelector(".cd-edit-btn");
  const isSel   = inp.tagName === "SELECT";

  const open = () => {
    if (!isSel) inp.value = disp.textContent === "—" ? "" : disp.textContent;
    disp.hidden = true;
    inp.hidden  = false;
    inp.focus();
  };

  const close = (revert) => {
    inp.hidden  = true;
    disp.hidden = false;
    if (revert && !isSel) inp.value = disp.textContent === "—" ? "" : disp.textContent;
  };

  const commit = async () => {
    const raw     = isSel ? inp.value : inp.value.trim();
    const dispTxt = isSel ? (inp.options[inp.selectedIndex]?.text || raw) : raw;
    const prev    = disp.textContent;
    if (!raw || raw === prev || (!raw && prev === "—")) { close(false); return; }
    close(false);
    const ok = await onSave(raw);
    if (ok) disp.textContent = dispTxt;
  };

  btn?.addEventListener("click", open);
  if (isSel) {
    inp.addEventListener("change", commit);
    inp.addEventListener("keydown", e => { if (e.key === "Escape") close(true); });
  } else {
    inp.addEventListener("blur", commit);
    inp.addEventListener("keydown", e => {
      if (e.key === "Enter")  { e.preventDefault(); inp.blur(); }
      if (e.key === "Escape") { close(true); }
    });
  }
}

function wireInlineEdits(tenant) {
  const slug = tenant.slug;

  makeEditable("cdDispName",  "cdInpName",  v => patchTenant(slug, { name: v }));
  makeEditable("cdDispEmail", "cdInpEmail", v => patchTenant(slug, { email: v }));
  makeEditable("cdDispType",  "cdInpType",  v => patchTenant(slug, { type: v }));

  // Admin fields — endpoint no existe aún
  const noDisp = () => { showToast("Función no disponible aún"); return Promise.resolve(false); };
  makeEditable("cdDispAdminName",  "cdInpAdminName",  noDisp);
  makeEditable("cdDispAdminEmail", "cdInpAdminEmail", noDisp);
}

// ── Carga de datos ─────────────────────────────────────────────────────────
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
  wireInlineEdits(tenant);

  document.getElementById("cdAdminBtn")?.addEventListener("click", () => {
    window.open(`/admin?tenant=${encodeURIComponent(tenant.slug)}`, "_blank");
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

  document.getElementById("cdDeleteBtn")?.addEventListener("click", async () => {
    if (!confirm(`¿Eliminar el centro "${tenant.name}"? Esta acción es irreversible.`)) return;
    try {
      const res = await apiFetch(`/api/v1/superadmin/tenants/${encodeURIComponent(tenant.slug)}`, { method: "DELETE" });
      if (!res.ok && (res.status === 404 || res.status === 405)) { showToast("Función no disponible aún"); return; }
      if (!res.ok) { showToast("Error al eliminar el centro"); return; }
      onBack?.();
    } catch { showToast("Error de red"); }
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
        buildHeader(tenant) +
        buildKPIs() +
        `<div class="cd-row2">${buildStudentsCard()}${buildTeachersCard()}</div>` +
        buildDangerZone(tenant);

      wireDetailEvents(tenant, onBack);
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
