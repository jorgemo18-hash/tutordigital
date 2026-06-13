// session-drawer.js — Drawer lateral para el historial del tutor IA.
// Soporta vista de sesión única y lista de ejercicios para tareas multi-ejercicio.

import { apiFetch } from "../../shared/js/auth.js";
import { formatStudentName, normalizeStudent } from "./state.js";
import { renderNotebook } from "./notebook.js";
import {
  SVG_CLOSE, SVG_ARROW,
  esc, fmtDate, fmtDateFromKey,
  renderFull,
} from "./session-drawer-render.js";

// ── Singleton: un solo overlay+panel en el DOM ────────────────────────────

let _overlay = null;
let _panel   = null;
let _stacked = false;

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
  _overlay?.classList.remove("open", "dd-overlay--stacked");
  _panel?.classList.remove("open", "dd-panel--stacked");
  _stacked = false;
  document.dispatchEvent(new CustomEvent("sessionDrawerClosed"));
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
      <h2 class="dd-name">${esc(studentName)}</h2>
      <div class="dd-meta">
        ${date ? `<span>${esc(date)}</span><span class="dd-dot-sep"></span>` : ""}
        <span>${esc(taskTitle || "Sin tarea")}</span>
      </div>
      ${subject ? `<div class="dd-chips"><span class="dd-chip"><em>Asignatura</em>${esc(subject)}</span></div>` : ""}
    </header>
    <div class="dd-body">
      <div class="dd-empty-line">El alumno aún no ha trabajado esta tarea con el tutor IA.</div>
    </div>`;
  _panel.querySelector(".dd-close").addEventListener("click", closeSessionDrawer);
}

// ── Exercise list render (multi-session task) ─────────────────────────────
// sessions: [{id, session_date, duration_seconds, needs_help, outcome, exercise_index, exercise_title}]

function _renderExerciseList({ studentName, taskTitle, sessions, onSelectSession }) {
  const outcomeLabel = { completed: "Completado", abandoned: "Abandonado", escalated: "Necesitó ayuda" };

  const itemsHtml = sessions.map((s, i) => {
    const label = s.exercise_title
      ? (s.exercise_index != null ? `Ejercicio ${s.exercise_index}: ${s.exercise_title}` : s.exercise_title)
      : (s.exercise_index != null ? `Ejercicio ${s.exercise_index}` : `Sesión ${i + 1}`);
    const status    = s.needs_help ? "help" : s.outcome === "completed" ? "solo" : "pend";
    const statusTxt = s.needs_help ? "Necesitó ayuda" : outcomeLabel[s.outcome] || s.outcome || "—";
    const date      = s.session_date ? fmtDateFromKey(s.session_date) : "";
    return `<button class="dd-ex-item" data-session-id="${esc(s.id)}" type="button">
      <span class="dd-ex-label">${esc(label)}</span>
      <span class="dd-ex-meta">
        ${date ? `<span>${esc(date)}</span>` : ""}
        <span class="dd-status-inline ${status}">${esc(statusTxt)}</span>
      </span>
      <span class="dd-ex-arrow">${SVG_ARROW}</span>
    </button>`;
  }).join("");

  _panel.innerHTML = `
    <header class="dd-head">
      <div class="dd-head-top">
        <span class="dd-status pend"><span class="dd-status-dot"></span>Historial de ejercicios</span>
        <button class="dd-close" aria-label="Cerrar">${SVG_CLOSE}</button>
      </div>
      <h2 class="dd-name">${esc(studentName)}</h2>
      <div class="dd-meta"><span>${esc(taskTitle || "Tarea")}</span></div>
    </header>
    <div class="dd-body">
      <div class="dd-ex-list">${itemsHtml}</div>
    </div>`;

  _panel.querySelector(".dd-close").addEventListener("click", closeSessionDrawer);
  _panel.querySelectorAll(".dd-ex-item").forEach(btn => {
    btn.addEventListener("click", () => onSelectSession(btn.dataset.sessionId));
  });
}

// ── Punto de entrada ──────────────────────────────────────────────────────

export async function openSessionDrawer(ctx, {
  studentId, dayKey, taskTitle, sessionId, taskId,
  readonly = false, dotColor = "pending", isAlreadyReviewed = false, stacked = false,
}) {
  _init();
  _stacked = stacked;
  if (_stacked) {
    _overlay.classList.add("dd-overlay--stacked");
    _panel.classList.add("dd-panel--stacked");
  } else {
    _overlay.classList.remove("dd-overlay--stacked");
    _panel.classList.remove("dd-panel--stacked");
  }

  const student     = normalizeStudent(ctx.state.data.students?.find(s => s.id === studentId));
  const studentName = student ? formatStudentName(student) : "Alumno";

  _overlay.classList.add("open");
  _panel.classList.add("open");
  _panel.innerHTML = `<div class="dd-loading"><div class="dd-spinner"></div>Cargando detalle…</div>`;

  // Sin sesión ni taskId → vista pendiente
  if (!sessionId && !taskId) {
    const taskObj = (ctx.state.data.weekTasks || ctx.state.data.tasks || []).find(t => t.title === taskTitle);
    _renderPending({
      studentName, taskTitle,
      subject: taskObj?.subjectName || "",
      date: dayKey ? fmtDateFromKey(dayKey) : "",
    });
    return;
  }

  // Multi-ejercicio: cuando hay taskId + studentId, buscar todas las sesiones del alumno para esa tarea
  if (taskId && studentId) {
    try {
      const res  = await apiFetch(`/api/v1/session/by-task/${encodeURIComponent(taskId)}?student_id=${encodeURIComponent(studentId)}`);
      const body = await res.json().catch(() => ({}));
      const sessions = body?.data?.sessions || [];

      if (sessions.length === 0) {
        const taskObj = (ctx.state.data.weekTasks || ctx.state.data.tasks || []).find(t => t.id === taskId || t.title === taskTitle);
        _renderPending({ studentName, taskTitle, subject: taskObj?.subjectName || "", date: dayKey ? fmtDateFromKey(dayKey) : "" });
        return;
      }

      if (sessions.length === 1 || sessionId) {
        // One session — or caller provided a specific sessionId — show it directly
        const targetId = sessionId || sessions[0].id;
        await _loadAndRenderSession(targetId, ctx, { dotColor, isAlreadyReviewed });
        return;
      }

      // Multiple sessions — show exercise list
      _renderExerciseList({
        studentName, taskTitle: taskTitle || "",
        sessions,
        onSelectSession: (sid) => _loadAndRenderSession(sid, ctx, { dotColor, isAlreadyReviewed }),
      });
    } catch {
      _panel.innerHTML = `<div class="dd-error-msg">Error de conexión.<br>
        <button style="margin-top:12px;background:none;border:1px solid rgba(242,237,229,0.18);color:rgba(242,237,229,0.70);border-radius:999px;padding:6px 14px;cursor:pointer;font-size:12px;" id="ddErrClose">Cerrar</button></div>`;
      _panel.querySelector("#ddErrClose")?.addEventListener("click", closeSessionDrawer);
    }
    return;
  }

  // Fallback: open specific session directly
  await _loadAndRenderSession(sessionId, ctx, { dotColor, isAlreadyReviewed });
}

async function _loadAndRenderSession(sessionId, ctx, { dotColor, isAlreadyReviewed }) {
  _panel.innerHTML = `<div class="dd-loading"><div class="dd-spinner"></div>Cargando detalle…</div>`;
  try {
    const res  = await apiFetch(`/api/v1/session/${encodeURIComponent(sessionId)}/detail`);
    const body = await res.json().catch(() => ({}));

    if (!res.ok) {
      _panel.innerHTML = `<div class="dd-error-msg">No se pudo cargar el detalle (${res.status}).<br>
        <button style="margin-top:12px;background:none;border:1px solid rgba(242,237,229,0.18);color:rgba(242,237,229,0.70);border-radius:999px;padding:6px 14px;cursor:pointer;font-size:12px;" id="ddErrClose">Cerrar</button></div>`;
      _panel.querySelector("#ddErrClose")?.addEventListener("click", closeSessionDrawer);
      return;
    }

    const detailData = body?.data || {};
    renderFull(_panel, closeSessionDrawer, detailData, ctx, { dotColor, isAlreadyReviewed });
  } catch {
    _panel.innerHTML = `<div class="dd-error-msg">Error de conexión.<br>
      <button style="margin-top:12px;background:none;border:1px solid rgba(242,237,229,0.18);color:rgba(242,237,229,0.70);border-radius:999px;padding:6px 14px;cursor:pointer;font-size:12px;" id="ddErrClose">Cerrar</button></div>`;
    _panel.querySelector("#ddErrClose")?.addEventListener("click", closeSessionDrawer);
  }
}
