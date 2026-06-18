// mobileAdminInicio.js — Tab Inicio: KPIs (dashboard endpoint), actividad
// hoy, accesos rápidos (jump to another tab + auto-open its sheet),
// cambiar de vista, cerrar sesión.

import { fetchDashboard } from "../mobileAdminData.js";

function _esc(s) { return String(s || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;"); }

export async function renderAdminInicio({ containerEl, fetchJSON, adminName, tenantName, goToTab, roleFlags, goTeacher, goStudent, onLogout }) {
  containerEl.innerHTML = `<p class="ad-loading">Cargando…</p>`;
  const dash = await fetchDashboard(fetchJSON).catch(() => null);
  const flags = roleFlags();
  const canChangeView = flags.hasTeacher || flags.hasStudent;

  const groupsCount     = dash?.groups_count ?? "—";
  const studentsActive  = dash?.students_active ?? "—";
  const teachersCount   = dash?.teachers_count ?? "—";
  const studentsPending = dash?.students_pending ?? 0;
  const activityStudents = dash?.activity_today?.students ?? 0;
  const activityTeachers = dash?.activity_today?.teachers ?? 0;

  containerEl.innerHTML = `
    <div class="ad-tab-header">
      <span class="ad-tab-eyebrow">${_esc(tenantName || "")}</span>
      <h1 class="ad-tab-title">Hola, ${_esc(adminName || "")}</h1>
    </div>

    <div class="ad-kpi-grid">
      <div class="ad-kpi-card"><span class="ad-kpi-num">${groupsCount}</span><span class="ad-kpi-label">Grupos</span></div>
      <div class="ad-kpi-card"><span class="ad-kpi-num">${studentsActive}</span><span class="ad-kpi-label">Alumnos activos</span></div>
      <div class="ad-kpi-card"><span class="ad-kpi-num">${teachersCount}</span><span class="ad-kpi-label">Profesores</span></div>
      <button type="button" class="ad-kpi-card" id="adIPendingCard"><span class="ad-kpi-num">${studentsPending}</span><span class="ad-kpi-label">Pendientes</span></button>
    </div>

    <div class="ad-section">
      <h3 class="ad-section-title">Actividad hoy</h3>
      <p class="ad-section-text">${activityStudents} alumno${activityStudents !== 1 ? "s" : ""} · ${activityTeachers} profesor${activityTeachers !== 1 ? "es" : ""} conectados</p>
    </div>

    <div class="ad-section">
      <h3 class="ad-section-title">Actividad reciente</h3>
      <p class="ad-empty">Disponible próximamente.</p>
    </div>

    <div class="ad-section">
      <h3 class="ad-section-title">Accesos rápidos</h3>
      <div class="ad-quick-actions">
        <button type="button" class="ad-quick-btn" id="adIQaGrupo">+ Nuevo grupo</button>
        <button type="button" class="ad-quick-btn" id="adIQaProfesor">+ Invitar profesor</button>
        <button type="button" class="ad-quick-btn" id="adIQaAlumno">+ Invitar alumno</button>
      </div>
    </div>

    <div class="ad-section ad-section--actions">
      ${canChangeView ? `<button type="button" class="ad-btn ad-btn--ghost" id="adIChangeView" style="width:100%">Cambiar de vista</button>` : ""}
      <button type="button" class="ad-btn ad-btn--danger" id="adILogout" style="width:100%">Cerrar sesión</button>
    </div>`;

  containerEl.querySelector("#adIPendingCard").addEventListener("click", () => goToTab("alumnos", { autoOpen: "#adAPendingCard" }));
  containerEl.querySelector("#adIQaGrupo").addEventListener("click", () => goToTab("grupos", { autoOpen: "#adGNewBtn" }));
  containerEl.querySelector("#adIQaProfesor").addEventListener("click", () => goToTab("profes", { autoOpen: "#adPInviteBtn" }));
  containerEl.querySelector("#adIQaAlumno").addEventListener("click", () => goToTab("alumnos", { autoOpen: "#adAInviteBtn" }));
  containerEl.querySelector("#adIChangeView")?.addEventListener("click", () => {
    if (flags.hasTeacher) goTeacher();
    else if (flags.hasStudent) goStudent();
  });
  containerEl.querySelector("#adILogout").addEventListener("click", () => {
    if (confirm("¿Cerrar sesión?")) onLogout();
  });
}
