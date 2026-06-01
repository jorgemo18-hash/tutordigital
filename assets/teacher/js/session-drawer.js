// session-drawer.js — Drawer lateral con el detalle de una sesión del tutor IA.
// Estructura y estilos basados en detalle.jsx / detalle.css del repositorio de diseño.

import { apiFetch } from "../../shared/js/auth.js";
import { formatStudentName, normalizeStudent } from "./state.js";

// ── Singleton: un solo overlay+panel en el DOM ────────────────────────────

let _overlay = null;
let _panel   = null;

function _init() {
  if (_overlay) return;

  _overlay = document.createElement("div");
  _overlay.className = "dd-overlay";
  _overlay.addEventListener("click", closeSessionDrawer);

  _panel = document.createElement("aside");
  _panel.className = "dd-panel";
  _panel.setAttribute("role", "dialog");
  _panel.setAttribute("aria-modal", "true");
  _panel.setAttribute("aria-label", "Detalle de sesión");
  _panel.addEventListener("click", (e) => e.stopPropagation());

  _overlay.appendChild(_panel);
  document.body.appendChild(_overlay);

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && _overlay?.classList.contains("open")) closeSessionDrawer();
  });
}

export function closeSessionDrawer() {
  _overlay?.classList.remove("open");
  _panel?.classList.remove("open");
}

// ── Helpers ───────────────────────────────────────────────────────────────

function _esc(str) {
  return String(str || "")
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function _initials(name = "") {
  const p = String(name || "").trim().split(/\s+/);
  return p.length >= 2 ? (p[0][0] + p[p.length - 1][0]).toUpperCase() : (p[0]?.[0] || "?").toUpperCase();
}

function _fmtTime(secs) {
  if (!secs) return "—";
  const m = Math.round(secs / 60);
  if (m < 1)  return "< 1m";
  return m >= 60 ? `${Math.floor(m / 60)}h${m % 60 ? ` ${m % 60}m` : ""}` : `${m}m`;
}

function _fmtDate(iso) {
  if (!iso) return "—";
  try {
    const d = new Date(iso + "T12:00:00");
    const day  = d.toLocaleDateString("es-ES", { weekday: "long" });
    const num  = d.getDate();
    const mon  = d.toLocaleDateString("es-ES", { month: "long" });
    return `${day.charAt(0).toUpperCase() + day.slice(1)} · ${num} ${mon}`;
  } catch { return iso; }
}

// ── SVG icons ─────────────────────────────────────────────────────────────

const SVG_CHECK  = `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="20 6 9 17 4 12"/></svg>`;
const SVG_X      = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" aria-hidden="true"><path d="M18 6 6 18M6 6l12 12"/></svg>`;
const SVG_CLOSE  = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M18 6 6 18M6 6l12 12"/></svg>`;
const SVG_SPARK  = `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M13 3l2.2 5.8L21 11l-5.8 2.2L13 19l-2.2-5.8L5 11l5.8-2.2L13 3z"/></svg>`;
const SVG_ARROW  = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>`;

// ── Step state helpers ────────────────────────────────────────────────────

function _stepState(step, currentStep, needsHelp) {
  if (step.completed)           return "bien";
  if (step.index === currentStep && needsHelp) return "atasco";
  if (step.index === currentStep)              return "atasco"; // current position
  if (step.index  > currentStep)              return "nollego";
  return "nollego";
}

const STEP_TAG = {
  bien:    "bien",
  atasco:  "se atascó aquí",
  error:   "error",
  nollego: "no llegó",
};

function _stepMark(st) {
  if (st === "bien")    return SVG_CHECK;
  if (st === "error")   return SVG_X;
  if (st === "atasco")  return `<span class="dd-step-ring"></span>`;
  return `<span class="dd-step-hollow"></span>`;
}

// ── Pending render (no session) ───────────────────────────────────────────

function _renderPending({ studentName, taskTitle, subject, date }) {
  _panel.innerHTML = `
    <header class="dd-head">
      <div class="dd-head-top">
        <span class="dd-status pend">
          <span class="dd-status-dot"></span>Pendiente
        </span>
        <button class="dd-close" aria-label="Cerrar">${SVG_CLOSE}</button>
      </div>
      <h2 class="dd-name">${_esc(studentName)}</h2>
      <div class="dd-meta">
        ${date ? `<span>${_esc(date)}</span><span class="dd-dot-sep"></span>` : ""}
        <span>${_esc(taskTitle || "Sin tarea")}</span>
      </div>
      ${subject ? `<div class="dd-chips"><span class="dd-chip"><em>Asignatura</em>${_esc(subject)}</span></div>` : ""}
    </header>
    <div class="dd-body">
      <div class="dd-empty-line">El alumno aún no ha trabajado esta tarea con el tutor IA.</div>
    </div>`;
  _panel.querySelector(".dd-close").addEventListener("click", closeSessionDrawer);
}

// ── Full render (with session) ────────────────────────────────────────────

function _renderFull(data, onMarcarRevisado) {
  const { session, student, task, stepMap, messages, note } = data;

  const statusClass = session.needs_help ? "help" : "solo";
  const statusLabel = session.needs_help ? "Necesitó ayuda" : "Resolvió solo";

  // Chips: asignatura, tiempo, intentos (= nº mensajes del alumno)
  const intentos = messages.filter(m => m.role === "user").length;

  // Steps HTML
  const stepsHtml = stepMap.steps.length
    ? `<ol class="dd-steps">${stepMap.steps.map(s => {
        const st   = _stepState(s, stepMap.currentStep, session.needs_help);
        const mark = _stepMark(st);
        const tag  = STEP_TAG[st] || st;
        return `<li class="dd-step ${st}">
          <span class="dd-step-mark">${mark}</span>
          <span class="dd-step-txt">${_esc(s.title)}</span>
          <span class="dd-step-tag">${_esc(tag)}</span>
        </li>`;
      }).join("")}</ol>`
    : `<div class="dd-empty-line">Sin mapa de pasos disponible.</div>`;

  // Chat HTML
  const chatHtml = messages.length
    ? `<div class="dd-chat">${messages.map(m => {
        const who = m.role === "user" ? "alumno" : "tutor";
        const aiIcon = who === "tutor" ? `<span class="dd-msg-ai">${SVG_SPARK}</span>` : "";
        return `<div class="dd-msg ${who}">${aiIcon}<div class="dd-bubble">${_esc(m.content)}</div></div>`;
      }).join("")}</div>`
    : `<div class="dd-empty-line">Sin conversación guardada.</div>`;

  // Nota section
  const noteHtml = note
    ? `<section class="dd-sect">
        <div class="dd-sect-eye"><span class="bar copper"></span>Nota del alumno</div>
        <div class="dd-note">
          <span class="dd-note-quote">❝</span>
          <p>${_esc(note.note_text)}</p>
        </div>
       </section>`
    : `<section class="dd-sect">
        <div class="dd-sect-eye"><span class="bar dim"></span>Nota del alumno</div>
        <div class="dd-empty-line">El alumno no dejó ninguna nota.</div>
       </section>`;

  const btnRevisado = note && note.is_read
    ? `<button class="dd-fbtn solid" id="ddBtnRevisar" disabled>Revisado ✓ ${SVG_ARROW}</button>`
    : `<button class="dd-fbtn solid" id="ddBtnRevisar">Marcar como revisado ${SVG_ARROW}</button>`;

  _panel.innerHTML = `
    <header class="dd-head">
      <div class="dd-head-top">
        <span class="dd-status ${statusClass}">
          <span class="dd-status-dot"></span>${statusLabel}
        </span>
        <button class="dd-close" aria-label="Cerrar">${SVG_CLOSE}</button>
      </div>
      <h2 class="dd-name">${_esc(student.name)}</h2>
      <div class="dd-meta">
        <span>${_esc(_fmtDate(session.session_date))}</span>
        ${task.title ? `<span class="dd-dot-sep"></span><span>${_esc(task.title)}</span>` : ""}
      </div>
      <div class="dd-chips">
        ${task.subject_name  ? `<span class="dd-chip"><em>Asignatura</em>${_esc(task.subject_name)}</span>` : ""}
        ${session.duration_seconds ? `<span class="dd-chip"><em>Tiempo</em>${_fmtTime(session.duration_seconds)}</span>` : ""}
        ${intentos > 0 ? `<span class="dd-chip"><em>Intentos</em>${intentos}</span>` : ""}
      </div>
    </header>
    <div class="dd-body">
      ${noteHtml}
      <section class="dd-sect">
        <div class="dd-sect-eye"><span class="bar copper"></span>Recorrido del ejercicio</div>
        <p class="dd-sect-help">Dónde se quedó el alumno, paso a paso.</p>
        ${stepsHtml}
      </section>
      <section class="dd-sect">
        <div class="dd-sect-eye"><span class="bar copper"></span>Conversación con el tutor</div>
        ${chatHtml}
      </section>
    </div>
    <footer class="dd-foot">
      ${btnRevisado}
    </footer>`;

  _panel.querySelector(".dd-close").addEventListener("click", closeSessionDrawer);

  const btnRevisar = _panel.querySelector("#ddBtnRevisar");
  if (btnRevisar && !note?.is_read) {
    btnRevisar.addEventListener("click", async () => {
      if (!note?.id) return;
      btnRevisar.disabled = true;
      btnRevisar.textContent = "Guardando…";
      try {
        await apiFetch(`/api/v1/student-notes/${encodeURIComponent(note.id)}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ is_read: true }),
        });
        btnRevisar.innerHTML = `Revisado ✓ ${SVG_ARROW}`;
        // Quitar indicador del dot
        const wrap = document.querySelector(`.nbDot-wrap[data-session-id="${session.id}"]`);
        wrap?.querySelector(".nbDot-unread")?.remove();
      } catch {
        btnRevisar.disabled = false;
        btnRevisar.innerHTML = `Marcar como revisado ${SVG_ARROW}`;
      }
    });
  }
}

// ── Punto de entrada ──────────────────────────────────────────────────────

export async function openSessionDrawer(ctx, { studentId, dayKey, taskTitle, sessionId, readonly = false }) {
  _init();

  const student     = normalizeStudent(ctx.state.data.students?.find(s => s.id === studentId));
  const studentName = student ? formatStudentName(student) : "Alumno";

  // Abrir con spinner
  _overlay.classList.add("open");
  _panel.classList.add("open");
  _panel.innerHTML = `
    <div class="dd-loading"><div class="dd-spinner"></div>Cargando detalle…</div>`;

  // Sin sesión → vista pendiente
  if (!sessionId) {
    const taskObj = (ctx.state.data.weekTasks || ctx.state.data.tasks || []).find(t => t.title === taskTitle);
    _renderPending({
      studentName,
      taskTitle,
      subject: taskObj?.subjectName || "",
      date: dayKey ? _fmtDateFromKey(dayKey) : "",
    });
    return;
  }

  try {
    const res  = await apiFetch(`/api/v1/session/${encodeURIComponent(sessionId)}/detail`);
    const body = await res.json().catch(() => ({}));

    if (!res.ok) {
      _panel.innerHTML = `<div class="dd-error-msg">No se pudo cargar el detalle (${res.status}).<br>
        <button style="margin-top:12px;background:none;border:1px solid rgba(242,237,229,0.18);color:rgba(242,237,229,0.70);border-radius:999px;padding:6px 14px;cursor:pointer;font-size:12px;" id="ddErrClose">Cerrar</button></div>`;
      _panel.querySelector("#ddErrClose")?.addEventListener("click", closeSessionDrawer);
      return;
    }

    _renderFull(body?.data || {}, null);
  } catch {
    _panel.innerHTML = `<div class="dd-error-msg">Error de conexión.<br>
      <button style="margin-top:12px;background:none;border:1px solid rgba(242,237,229,0.18);color:rgba(242,237,229,0.70);border-radius:999px;padding:6px 14px;cursor:pointer;font-size:12px;" id="ddErrClose">Cerrar</button></div>`;
    _panel.querySelector("#ddErrClose")?.addEventListener("click", closeSessionDrawer);
  }
}

function _fmtDateFromKey(iso) {
  try {
    const d = new Date(iso + "T12:00:00");
    return d.toLocaleDateString("es-ES", { weekday: "long", day: "numeric", month: "long" }).replace(/^\w/, c => c.toUpperCase());
  } catch { return iso; }
}
