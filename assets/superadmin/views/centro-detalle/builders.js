import { escHtml, fmtDate } from "./helpers.js";
import { STATUS_LABELS, STATUS_CLS, TYPE_LABELS, TYPE_OPTS, REGIMEN_FISCAL_LABELS, SECTOR_LABELS } from "./constants.js";

// Fila extra de "Datos del centro" condicionada por tipo — academia
// muestra régimen fiscal, standalone/integrado muestra sector, sin tipo
// no muestra ninguna (mismo criterio que el campo condicional del alta,
// ver nuevoCentroForm.js).
function buildTipoExtraRowHtml(t) {
  if (t.type === "academia") {
    return `<div class="sa-dl-row"><dt class="sa-dt">Régimen fiscal</dt><dd class="sa-dd">${REGIMEN_FISCAL_LABELS[t.regimen_fiscal] || "—"}</dd></div>`;
  }
  if (t.type === "standalone" || t.type === "integrado") {
    return `<div class="sa-dl-row"><dt class="sa-dt">Sector</dt><dd class="sa-dd">${SECTOR_LABELS[t.sector] || "—"}</dd></div>`;
  }
  return "";
}

export function buildHead(t, onBack) {
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

export function buildKPIs() {
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

export function buildInfoPanel(t) {
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

export function renderInfoRead(t, ad) {
  return `
    <div class="sa-info-grid">
      <div>
        <div class="sa-info-eye">Datos del centro</div>
        <dl class="sa-dl">
          <div class="sa-dl-row"><dt class="sa-dt">Nombre</dt><dd class="sa-dd">${escHtml(t.name)}</dd></div>
          <div class="sa-dl-row"><dt class="sa-dt">Tipo</dt><dd class="sa-dd">${TYPE_LABELS[t.type] || "—"}</dd></div>
          ${buildTipoExtraRowHtml(t)}
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

export function renderInfoEdit(t, ad) {
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

export function buildPeopleRow() {
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

export function buildDangerZone(t) {
  const status = t.status || "active";
  const opt = v => `<option value="${v}"${status === v ? " selected" : ""}>${STATUS_LABELS[v]}</option>`;
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
