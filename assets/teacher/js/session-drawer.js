// session-drawer.js — Drawer lateral para el historial del tutor IA.
// Soporta vista de sesión única y lista de ejercicios para tareas multi-ejercicio.

import { apiFetch } from "../../shared/js/auth.js";
import { formatStudentName, normalizeStudent } from "./state.js";
import { renderNotebook } from "./notebook.js";
import {
  SVG_CLOSE,
  esc, fmtDateFromKey,
  renderFull,
} from "./session-drawer-render.js";
import { renderTaskView } from "./features/session-task-view.js";

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

  // Tarea con taskId: cargar todas las sesiones y mostrar vista de tarea
  if (taskId && studentId) {
    try {
      const res  = await apiFetch(`/api/v1/session/by-task/${encodeURIComponent(taskId)}?student_id=${encodeURIComponent(studentId)}`);
      const body = await res.json().catch(() => ({}));
      const sessions       = body?.data?.sessions       || [];
      const totalExercises = body?.data?.totalExercises || 0;

      if (sessions.length === 0) {
        const taskObj = (ctx.state.data.weekTasks || ctx.state.data.tasks || []).find(t => t.id === taskId || t.title === taskTitle);
        _renderPending({ studentName, taskTitle, subject: taskObj?.subjectName || "", date: dayKey ? fmtDateFromKey(dayKey) : "" });
        return;
      }

      const taskObj    = (ctx.state.data.weekTasks || ctx.state.data.tasks || []).find(t => t.id === taskId);
      const allReviewed = sessions.every(s => s.teacher_reviewed);
      renderTaskView(_panel, closeSessionDrawer, sessions, { studentName, taskTitle, taskObj, dayKey, totalExercises }, ctx, { isAlreadyReviewed: allReviewed });
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
