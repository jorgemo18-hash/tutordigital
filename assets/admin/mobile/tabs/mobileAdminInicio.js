// mobileAdminInicio.js — Tab Inicio: hero + KPIs (dashboard endpoint),
// actividad hoy, accesos rápidos, cambiar de vista, cerrar sesión.
// Structure/classes match the reference design's AdminDashboard exactly.

import { fetchDashboard } from "../mobileAdminData.js";
import { icon } from "../mobileAdminIcons.js";

function _esc(s) { return String(s || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;"); }

function _todayLabel() {
  return new Date().toLocaleDateString("es-ES", { weekday: "long", day: "numeric", month: "long" });
}

export async function renderAdminInicio({ containerEl, fetchJSON, adminName, tenantName, goToTab, roleFlags, goTeacher, goStudent, onLogout }) {
  containerEl.innerHTML = `<p class="dcard-empty">Cargando…</p>`;
  const dash  = await fetchDashboard(fetchJSON).catch(() => null);
  const flags = roleFlags();
  const canChangeView = flags.hasTeacher || flags.hasStudent;
  const today = _todayLabel();

  const stats = [
    { eye: "Grupos activos",     num: dash?.groups_count ?? "—",     foot: "Primaria · ESO · Bach.",   accent: false },
    { eye: "Alumnos activos",    num: dash?.students_active ?? "—",  foot: "Con acceso activo",        accent: true },
    { eye: "Profesores",         num: dash?.teachers_count ?? "—",   foot: "Del centro",                accent: false },
    { eye: "Pendientes aprob.",  num: dash?.students_pending ?? 0,   foot: "Alumnos sin aprobar",       accent: false },
  ];
  const activityStudents = dash?.activity_today?.students ?? 0;
  const activityTeachers = dash?.activity_today?.teachers ?? 0;

  containerEl.innerHTML = `
    <div class="phead">
      <div class="phead-eyebrow">Zona admin · Director</div>
      <h1 class="phead-title">Hola, <em>${_esc(adminName || "")}</em></h1>
      <div class="phead-meta"><span>${_esc(tenantName || "")}</span><span class="sep"></span><span>${_esc(today)}</span></div>
    </div>

    <div class="dash">
      <div class="dash-hero">
        <div class="dash-hero-eye">Resumen del centro</div>
        <div class="dash-hero-name">${_esc(tenantName || "")}</div>
        <div class="dash-hero-sub">Curso 2025–26</div>
      </div>

      <div class="dash-stats">
        ${stats.map(s => `
          <div class="dstat ${s.accent ? "accent" : ""}">
            <span class="dstat-eye">${_esc(s.eye)}</span>
            <div class="dstat-num">${s.num}</div>
            <div class="dstat-foot"><span class="dot"></span>${_esc(s.foot)}</div>
          </div>`).join("")}
      </div>

      <div class="dcard">
        <div class="dcard-title">Actividad hoy</div>
        <div class="dcard-sub">${_esc(today)}</div>
        <div class="dcard-today">
          <span class="dcard-today-num">${activityStudents}</span>
          <span class="dcard-today-lbl">alumno${activityStudents !== 1 ? "s" : ""}<br>en el tutor</span>
          <span class="dcard-today-lbl" style="margin-left:auto;text-align:right">${activityTeachers > 0 ? `${activityTeachers} profesor${activityTeachers !== 1 ? "es" : ""}<br>han accedido hoy` : "Ningún profesor<br>ha accedido hoy"}</span>
        </div>
      </div>

      <div class="dcard">
        <div class="dcard-title">Actividad reciente</div>
        <div class="dcard-sub">Últimas sesiones en el tutor</div>
        <div class="dcard-empty">No hay actividad reciente.</div>
      </div>

      <div class="seclabel" style="padding:2px 0 4px"><span class="seclabel-name">Accesos rápidos</span><span class="seclabel-line"></span></div>
      <div class="quickgrid">
        <button type="button" class="quickcard" id="adIQaGrupo">
          <span class="quickcard-ic">${icon("group", { size: 20 })}</span>
          <div class="quickcard-main"><div class="quickcard-eye">Grupos</div><div class="quickcard-title">Crear grupo</div></div>
          <span class="quickcard-go">${icon("enter", { size: 18 })}</span>
        </button>
        <button type="button" class="quickcard" id="adIQaProfesor">
          <span class="quickcard-ic">${icon("board", { size: 20 })}</span>
          <div class="quickcard-main"><div class="quickcard-eye">Profesores</div><div class="quickcard-title">Invitar profesor</div></div>
          <span class="quickcard-go">${icon("enter", { size: 18 })}</span>
        </button>
        <button type="button" class="quickcard" id="adIQaAlumno">
          <span class="quickcard-ic">${icon("cap", { size: 20 })}</span>
          <div class="quickcard-main"><div class="quickcard-eye">Alumnos</div><div class="quickcard-title">Invitar alumno</div></div>
          <span class="quickcard-go">${icon("enter", { size: 18 })}</span>
        </button>
      </div>

      ${canChangeView ? `
      <div class="seclabel" style="padding:8px 0 4px"><span class="seclabel-name">Cambiar de vista</span><span class="seclabel-line"></span></div>
      <div class="viewswitch">
        ${flags.hasTeacher ? `<button type="button" class="btn btn-ghost" id="adIViewTeacher">${icon("board", { size: 16 })} Ver como profesor</button>` : ""}
        ${flags.hasStudent ? `<button type="button" class="btn btn-ghost" id="adIViewStudent">${icon("cap", { size: 16 })} Ver como alumno</button>` : ""}
      </div>` : ""}
      <button type="button" class="dash-logout" id="adILogout">${icon("exit", { size: 17 })} Cerrar sesión</button>
    </div>`;

  containerEl.querySelector("#adIQaGrupo").addEventListener("click", () => goToTab("grupos", { autoOpen: "#adGNewBtn" }));
  containerEl.querySelector("#adIQaProfesor").addEventListener("click", () => goToTab("profes", { autoOpen: "#adPInviteBtn" }));
  containerEl.querySelector("#adIQaAlumno").addEventListener("click", () => goToTab("alumnos", { autoOpen: "#adAInviteBtn" }));
  containerEl.querySelector("#adIViewTeacher")?.addEventListener("click", () => goTeacher());
  containerEl.querySelector("#adIViewStudent")?.addEventListener("click", () => goStudent());
  containerEl.querySelector("#adILogout").addEventListener("click", () => {
    if (confirm("¿Cerrar sesión?")) onLogout();
  });
}
