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

// ── HTML builders ──────────────────────────────────────────────────────────
function buildHeader(t) {
  const status  = t.status || "active";
  const typeLbl = TYPE_LABELS[t.type] || t.type || "";
  return `
    <div class="cd-header-card table-card">
      <div class="cd-header-main">
        <div class="cd-header-info">
          <div class="cd-header-name">${escHtml(t.name)}</div>
          <div class="cd-header-meta">
            ${typeLbl ? `<span class="badge inactive cd-type-badge">${escHtml(typeLbl)}</span>` : ""}
            <span class="badge ${status}">${STATUS_LABELS[status] || status}</span>
            <code class="cd-slug">${escHtml(t.slug)}</code>
          </div>
          <div class="cd-header-row2">
            <span class="cd-meta-item">
              <span class="cd-meta-label">Email</span>
              <span class="cd-meta-val">${escHtml(t.email || "—")}</span>
            </span>
            <span class="cd-meta-item">
              <span class="cd-meta-label">Creado</span>
              <span class="cd-meta-val">${fmtDate(t.created_at)}</span>
            </span>
          </div>
        </div>
        <button class="btn-primary cd-admin-btn" id="cdAdminBtn" type="button">
          Entrar como admin →
        </button>
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
      <div class="cd-people-body" id="cdStudentsBody">
        <div class="cd-empty">Cargando…</div>
      </div>
    </div>`;
}

function buildTeachersCard() {
  return `
    <div class="table-card">
      <div class="table-header"><span class="table-title">Docentes</span></div>
      <div class="cd-people-body" id="cdTeachersBody">
        <div class="cd-empty">Cargando…</div>
      </div>
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
  return `
    <div class="cd-person-row">
      <div class="cd-avatar">${escHtml(init)}</div>
      <div class="cd-person-info">
        <div class="cd-person-name">${escHtml(s.display_name || s.email || "—")}</div>
        <div class="cd-person-sub">${relativeDate(s.last_seen || s.created_at)}</div>
      </div>
    </div>`;
}

function teacherRow(t) {
  const init = (t.display_name || t.email || "?")[0].toUpperCase();
  return `
    <div class="cd-person-row">
      <div class="cd-avatar cd-avatar-teacher">${escHtml(init)}</div>
      <div class="cd-person-info">
        <div class="cd-person-name">
          ${escHtml(t.display_name || "—")}
          ${t.is_admin ? `<span class="badge active cd-admin-badge">Admin</span>` : ""}
        </div>
        <div class="cd-person-sub">${escHtml(t.email || "—")}</div>
      </div>
    </div>`;
}

async function loadAndRenderPeople(slug) {
  const { students, teachers } = await loadTenantData(slug);

  const set = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };
  set("cdKpiAlumnos",  students.length || "—");
  set("cdKpiDocentes", teachers.length || "—");

  const sBody = document.getElementById("cdStudentsBody");
  if (sBody) {
    const last5 = students.slice(0, 5);
    sBody.innerHTML = last5.length
      ? last5.map(studentRow).join("")
      : `<div class="cd-empty">Sin alumnos aún</div>`;
  }

  const tBody = document.getElementById("cdTeachersBody");
  if (tBody) {
    tBody.innerHTML = teachers.length
      ? teachers.map(teacherRow).join("")
      : `<div class="cd-empty">Sin docentes aún</div>`;
  }
}

// ── Eventos ────────────────────────────────────────────────────────────────
function wireDetailEvents(tenant, onBack) {
  document.getElementById("cdAdminBtn")?.addEventListener("click", () => {
    window.open(`/admin?tenant=${encodeURIComponent(tenant.slug)}`, "_blank");
  });

  const saveBtn = document.getElementById("cdStatusSaveBtn");
  saveBtn?.addEventListener("click", async () => {
    const sel = document.getElementById("cdStatusSelect");
    saveBtn.disabled = true;
    saveBtn.textContent = "Guardando…";
    try {
      const res = await apiFetch(`/api/v1/superadmin/tenants/${encodeURIComponent(tenant.slug)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: sel?.value }),
      });
      if (!res.ok) {
        alert(res.status === 404 || res.status === 405
          ? "Función no disponible aún"
          : "Error al guardar el estado");
      } else {
        saveBtn.textContent = "¡Guardado!";
        setTimeout(() => { saveBtn.textContent = "Guardar"; saveBtn.disabled = false; }, 1500);
        return;
      }
    } catch { alert("Error de red"); }
    saveBtn.disabled = false;
    saveBtn.textContent = "Guardar";
  });

  document.getElementById("cdDeleteBtn")?.addEventListener("click", async () => {
    if (!confirm(`¿Eliminar el centro "${tenant.name}"? Esta acción es irreversible.`)) return;
    try {
      const res = await apiFetch(`/api/v1/superadmin/tenants/${encodeURIComponent(tenant.slug)}`, {
        method: "DELETE",
      });
      if (!res.ok && (res.status === 404 || res.status === 405)) {
        alert("Función no disponible aún"); return;
      }
      if (!res.ok) { alert("Error al eliminar el centro"); return; }
      onBack?.();
    } catch { alert("Error de red"); }
  });
}

// ── Fábrica del módulo ─────────────────────────────────────────────────────
export function createCentroDetalleView(panelEl) {
  let savedFragment = null;

  return {
    show(tenant, onBack) {
      // Guardar contenido actual del panel
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
