// mobileTeacherCuaderno.js — Cuaderno tab for the mobile teacher panel.

import { getWeekDays, formatYMDLocal } from "../js/notebook-week.js";
import { fmtTime } from "../js/session-drawer-render.js";
import { mtFetchStudents, mtFetchSessionsForWeek, mtFetchTasks } from "./mobileTeacherData.js";
import { openSessionSheet, openSheet, closeSheet } from "./mobileTeacherSheets.js";
import { wireSubjectFilter } from "./subjects/subjectSelect.js";
import { saveGroupId } from "./subjects/subjectPrefs.js";
import { renderTrimestre } from "./cuaderno-trimestre/trimestreController.js";
import { defaultTrimester, buildPeriodTasks, buildTaskMaps, tagGradesByType } from "./cuaderno-trimestre/trimestreCalc.js";
import { mtFetchGradesRange } from "./cuaderno-trimestre/trimestreData.js";
import { renderNotas } from "./cuaderno-notas/notasController.js";
import { renderGradesList } from "./grades-sheet/gradesListSheet.js";
import { escHtml as _esc } from "../../shared/js/escHtml.js";

const DAY_LABELS = ["L", "M", "X", "J", "V"];

const SVG_PREV = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><polyline points="15 18 9 12 15 6"/></svg>`;
const SVG_NEXT = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><polyline points="9 18 15 12 9 6"/></svg>`;
const SVG_NOTE = `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>`;
const SVG_CLOCK = `<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>`;

function _initials(name) {
  const p = String(name || "").trim().split(/\s+/);
  return (p.length >= 2 ? p[0][0] + p[p.length - 1][0] : p[0]?.[0] || "?").toUpperCase();
}
function _weekLabel(weekOffset) {
  const days = getWeekDays(weekOffset);
  const from = days[0], to = days[4];
  const fmt  = d => `${d.getDate()} ${d.toLocaleDateString("es-ES", { month: "short" })}`;
  const now  = new Date();
  const isoNow = formatYMDLocal(now);
  const isoFrom = formatYMDLocal(from);
  const currentWeekMonday = getWeekDays(0)[0];
  const relOffset = Math.round((from - currentWeekMonday) / (7 * 86400000));
  const sub = relOffset === 0 ? "Esta semana" : relOffset === -1 ? "Semana pasada" : relOffset === 1 ? "Próxima semana" : `Semana ${_isoWeekNum(from)}`;
  return { main: `${fmt(from)} – ${fmt(to)}`, sub };
}
function _isoWeekNum(d) {
  const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const dayNum = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  return Math.ceil((((date - yearStart) / 86400000) + 1) / 7);
}

function _dotClass(sessions, studentId, dayKey, tasks) {
  const daySessions = sessions.filter(s => s.student_id === studentId && s.session_date === dayKey);
  if (!daySessions.length) {
    const hasTask = tasks.some(t => t.type === "homework" && t.due_date === dayKey);
    return hasTask ? "pending" : "empty";
  }
  if (daySessions.some(s => s.outcome === "abandoned" || s.needs_help)) return "needs";
  if (daySessions.some(s => s.outcome === "completed")) return "done";
  return "pending";
}

function _sessionIdForDot(sessions, studentId, dayKey) {
  const daySessions = sessions
    .filter(s => s.student_id === studentId && s.session_date === dayKey)
    .sort((a, b) => (b.created_at || "") > (a.created_at || "") ? 1 : -1);
  const terminal = daySessions.find(s => s.outcome === "completed" || s.outcome === "abandoned");
  return (terminal || daySessions[0])?.id || null;
}

function _totalTime(sessions, studentId) {
  return sessions
    .filter(s => s.student_id === studentId)
    .reduce((acc, s) => acc + (s.duration_seconds || 0), 0);
}

function _hasUnreadNote(studentNotes, studentId) {
  return (studentNotes || []).some(n => n.student_id === studentId && !n.is_read);
}

function _renderStudentCard(student, sessions, tasks, studentGrades, dayKeys, studentNotes, sheetEl, backdropEl, apiFetch) {
  const card = document.createElement("div");
  card.className = "mt-scard";

  const initials = _initials(student.name);
  const hasNote  = _hasUnreadNote(studentNotes, student.id);
  const totalSec = _totalTime(sessions, student.id);

  const hwTotal = tasks.filter(t => t.type === "homework").length;
  const hwDone  = sessions.filter(s => s.student_id === student.id && s.duration_seconds > 0 && s.outcome === "completed").length;

  const head = document.createElement("div");
  head.className = "mt-scard-head";
  head.innerHTML = `
    <div class="mt-avatar">${_esc(initials)}</div>
    <div class="mt-scard-info">
      <div class="mt-scard-name">${_esc(student.name)}</div>
      ${hwTotal ? `<div class="mt-scard-sub">Deberes ${hwDone}/${hwTotal}</div>` : ""}
    </div>
    <button class="mt-ver-btn" type="button" data-action="notas">Notas</button>
    ${hasNote ? `<button class="mt-note-btn" aria-label="Ver nota" data-student-id="${_esc(student.id)}">${SVG_NOTE}<span class="mt-note-badge"></span></button>` : ""}`;
  head.querySelector('[data-action="notas"]')?.addEventListener("click", () => {
    const contentEl = sheetEl.querySelector("#mtSheetContent");
    const close = () => closeSheet(sheetEl, backdropEl);
    renderGradesList({
      contentEl, title: `Notas · ${student.name}`, grades: studentGrades, apiFetch,
      onBack: close, onClose: close,
    });
    openSheet(sheetEl, backdropEl);
  });
  card.appendChild(head);

  const dotsRow = document.createElement("div");
  dotsRow.className = "mt-dots-row";

  dayKeys.forEach((dayKey, i) => {
    const color     = _dotClass(sessions, student.id, dayKey, tasks);
    const sessionId = color !== "empty" && color !== "pending" ? _sessionIdForDot(sessions, student.id, dayKey) : null;
    const dayEl = document.createElement("div");
    dayEl.className = "mt-dot-day";

    const label = document.createElement("span");
    label.className = "mt-dot-label";
    label.textContent = DAY_LABELS[i];

    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = `mt-dot-btn mt-dot-btn--${color}`;
    btn.disabled = (color === "empty" || color === "pending");

    const dotInner = document.createElement("span");
    dotInner.className = `mt-dot mt-dot--${color === "empty" ? "pending" : color}`;
    btn.appendChild(dotInner);

    if (sessionId) {
      btn.addEventListener("click", () => openSessionSheet({
        sheetEl, backdropEl,
        sessionId,
        studentName: student.name,
        apiFetch,
      }));
    }

    dayEl.appendChild(label);
    dayEl.appendChild(btn);
    dotsRow.appendChild(dayEl);
  });
  card.appendChild(dotsRow);

  if (totalSec > 0) {
    const foot = document.createElement("div");
    foot.className = "mt-scard-foot";
    foot.innerHTML = `<span class="mt-foot-item">${SVG_CLOCK} Tutor ${_esc(fmtTime(totalSec))}</span>`;
    card.appendChild(foot);
  }

  return card;
}

function _buildHeader(headerEl, mtState, refreshFn) {
  if (!mtState.periodMode || mtState.periodMode === "mes") mtState.periodMode = "semana";
  const { main, sub } = _weekLabel(mtState.weekOffset);
  const weekNavHtml = mtState.periodMode === "semana"
    ? `<div class="mt-week-nav">
        <button class="mt-week-arrow" id="mtWeekPrev" aria-label="Semana anterior">${SVG_PREV}</button>
        <div class="mt-week-label">${_esc(main)}<small>${_esc(sub)}</small></div>
        <button class="mt-week-arrow" id="mtWeekNext" aria-label="Semana siguiente">${SVG_NEXT}</button>
       </div>`
    : "";
  const act = v => v === mtState.periodMode  ? "mt-seg-btn--active" : "";
  const actV = v => v === mtState.cuadernoView ? "mt-seg-btn--active" : "";
  const isTrimestre = mtState.periodMode === "trimestre";
  if (isTrimestre && !mtState.trimester) mtState.trimester = defaultTrimester();
  // "Poner notas" makes no sense per-week in Trimestre — the selector
  // disappears entirely there and the view always falls back to "Por alumno".
  if (isTrimestre && mtState.cuadernoView === "notes") mtState.cuadernoView = "student";
  const trimSelectHtml = isTrimestre
    ? `<select class="mt-group-select" id="mtTrimSelect">
        <option value="1" ${mtState.trimester === 1 ? "selected" : ""}>1º trimestre</option>
        <option value="2" ${mtState.trimester === 2 ? "selected" : ""}>2º trimestre</option>
        <option value="3" ${mtState.trimester === 3 ? "selected" : ""}>3º trimestre</option>
       </select>`
    : "";
  headerEl.innerHTML = `
    <div class="mt-header-eyebrow">CUADERNO</div>
    <h1 class="mt-header-title">Progreso del <em>grupo</em></h1>
    <div class="mt-select-row">
      <select class="mt-group-select" id="mtGroupSelect"></select>
      <select class="mt-group-select" id="mtSubjectSelect" hidden></select>
    </div>
    ${trimSelectHtml}
    <div class="mt-seg" id="mtPeriodSeg">
      <button class="mt-seg-btn ${act("semana")}"    data-period="semana">Semana</button>
      <button class="mt-seg-btn ${act("trimestre")}" data-period="trimestre">Trimestre</button>
    </div>
    ${weekNavHtml}
    ${isTrimestre ? "" : `
    <div class="mt-seg" id="mtViewSeg">
      <button class="mt-seg-btn ${actV("student")}" data-view="student">Por alumno</button>
      <button class="mt-seg-btn ${actV("notes")}"   data-view="notes">Poner notas</button>
    </div>`}`;

  if (isTrimestre) {
    headerEl.querySelector("#mtTrimSelect").addEventListener("change", e => {
      mtState.trimester = Number(e.target.value);
      refreshFn();
    });
  }

  const sel = headerEl.querySelector("#mtGroupSelect");
  mtState.groups.forEach(g => {
    const opt = document.createElement("option");
    opt.value = g.id;
    opt.textContent = g.name;
    if (g.id === mtState.currentGroupId) opt.selected = true;
    sel.appendChild(opt);
  });
  sel.addEventListener("change", () => {
    mtState.currentGroupId = sel.value;
    mtState.currentSubjectName = "";
    saveGroupId(sel.value);
    refreshFn();
  });

  if (mtState.periodMode === "semana") {
    headerEl.querySelector("#mtWeekPrev").addEventListener("click", () => { mtState.weekOffset--; refreshFn(); });
    headerEl.querySelector("#mtWeekNext").addEventListener("click", () => { mtState.weekOffset++; refreshFn(); });
  }

  headerEl.querySelectorAll("#mtPeriodSeg .mt-seg-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      headerEl.querySelectorAll("#mtPeriodSeg .mt-seg-btn").forEach(b => b.classList.remove("mt-seg-btn--active"));
      btn.classList.add("mt-seg-btn--active");
      mtState.periodMode = btn.dataset.period;
      refreshFn();
    });
  });

  headerEl.querySelectorAll("#mtViewSeg .mt-seg-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      headerEl.querySelectorAll("#mtViewSeg .mt-seg-btn").forEach(b => b.classList.remove("mt-seg-btn--active"));
      btn.classList.add("mt-seg-btn--active");
      mtState.cuadernoView = btn.dataset.view;
      refreshFn();
    });
  });
}

export async function initMtCuaderno({ pageEl, headerEl, sheetEl, backdropEl, sheetEl2, backdropEl2, mtState, apiFetch, studentNotes }) {
  function _buildLegend() {
    const leg = document.createElement("div");
    leg.className = "mt-legend";
    leg.innerHTML = `
      <span class="mt-legend-item"><span class="mt-dot mt-dot--done"></span>Solo</span>
      <span class="mt-legend-item"><span class="mt-dot mt-dot--needs"></span>Con ayuda</span>
      <span class="mt-legend-item"><span class="mt-dot mt-dot--pending"></span>Pendiente</span>`;
    return leg;
  }

  const cardsEl = document.createElement("div");
  cardsEl.className = "mt-cards";
  cardsEl.id = "mtCards";
  pageEl.appendChild(_buildLegend());
  pageEl.appendChild(cardsEl);

  async function refresh() {
    _buildHeader(headerEl, mtState, refresh);

    const groupId = mtState.currentGroupId;
    if (!groupId) { cardsEl.innerHTML = `<div class="mt-loading">Selecciona un grupo.</div>`; return; }

    await wireSubjectFilter({
      selectEl: headerEl.querySelector("#mtSubjectSelect"),
      mtState, apiFetch, groupId,
      onChange: refresh,
    });

    if (mtState.cuadernoView === "notes") {
      await renderNotas({ containerEl: cardsEl, sheetEl, backdropEl, mtState, apiFetch });
      return;
    }

    if (mtState.periodMode === "trimestre") {
      await renderTrimestre({ cardsEl, sheetEl, backdropEl, sheetEl2, backdropEl2, mtState, apiFetch });
      return;
    }

    cardsEl.innerHTML = `<div class="mt-loading">Cargando…</div>`;

    const days    = getWeekDays(mtState.weekOffset);
    const dayKeys = days.map(formatYMDLocal);

    const [students, sessions, tasksAll, weekGrades] = await Promise.all([
      mtFetchStudents(apiFetch, groupId),
      mtFetchSessionsForWeek(apiFetch, groupId, mtState.weekOffset),
      mtFetchTasks(apiFetch, groupId),
      mtFetchGradesRange(apiFetch, groupId, dayKeys[0], dayKeys[4]),
    ]);
    const tasks = mtState.currentSubjectName
      ? tasksAll.filter(t => t.subject_name === mtState.currentSubjectName)
      : tasksAll;

    mtState.students = students;
    mtState.sessions = sessions;

    // Exam/work grades for the week, tagged by task type the same way the
    // Trimestre view does — independent of the active subject filter, since
    // grades themselves aren't subject-scoped anywhere else in this app.
    const periodTasks = buildPeriodTasks(tasksAll, dayKeys[0], dayKeys[4]);
    const { taskTypeMap, taskTitleMap } = buildTaskMaps(periodTasks);
    const taggedGrades = tagGradesByType(weekGrades, taskTypeMap, taskTitleMap);

    cardsEl.innerHTML = "";
    if (!students.length) {
      cardsEl.innerHTML = `<div class="mt-loading">No hay alumnos en este grupo.</div>`;
      return;
    }

    students.forEach(student => {
      const studentGrades = taggedGrades.filter(g =>
        g.student_id === student.id && (g._taskType === "exam" || g._taskType === "work")
      );
      const card = _renderStudentCard(student, sessions, tasks, studentGrades, dayKeys, studentNotes, sheetEl, backdropEl, apiFetch);
      cardsEl.appendChild(card);
    });
  }

  await refresh();
}

