// session-drawer.js — Drawer lateral con el detalle de una sesión del tutor IA.
// Reemplaza el modal plano que se usaba en openSessionModal.

import { apiFetch } from "../../shared/js/auth.js";
import { formatStudentName, normalizeStudent } from "./state.js";

// Singleton: un solo par backdrop/drawer en el DOM.
let _backdrop = null;
let _drawer   = null;
let _currentNoteId = null;

function _init() {
  if (_backdrop) return;

  _backdrop = document.createElement("div");
  _backdrop.className = "dd-backdrop";
  _backdrop.addEventListener("click", closeSessionDrawer);

  _drawer = document.createElement("div");
  _drawer.className = "dd-drawer";
  _drawer.setAttribute("role", "dialog");
  _drawer.setAttribute("aria-modal", "true");
  _drawer.setAttribute("aria-label", "Detalle de sesión");

  document.body.appendChild(_backdrop);
  document.body.appendChild(_drawer);

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") closeSessionDrawer();
  });
}

export function closeSessionDrawer() {
  if (!_drawer) return;
  _backdrop?.classList.remove("is-open");
  _drawer.classList.remove("is-open");
  _currentNoteId = null;
}

function _initials(name = "") {
  const parts = String(name || "").trim().split(/\s+/);
  if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  return (parts[0]?.[0] || "?").toUpperCase();
}

function _fmtTime(secs) {
  if (!secs) return "—";
  const m = Math.round(secs / 60);
  if (m < 1) return "< 1 min";
  return m >= 60
    ? `${Math.floor(m / 60)}h ${m % 60 > 0 ? m % 60 + " min" : ""}`.trim()
    : `${m} min`;
}

function _fmtDate(iso) {
  if (!iso) return "—";
  try {
    return new Date(iso + "T12:00:00").toLocaleDateString("es-ES", {
      weekday: "long", day: "numeric", month: "long"
    });
  } catch { return iso; }
}

// ── Pending mode: sin sesión IA, solo datos básicos ───────────────────────

function _renderPending({ studentName, taskTitle, subject }) {
  _drawer.innerHTML = `
    <button class="dd-close" aria-label="Cerrar">✕</button>
    <div class="dd-header">
      <div class="dd-header-top">
        <div class="dd-avatar">${_initials(studentName)}</div>
        <div>
          <div class="dd-student-name">${_esc(studentName)}</div>
          <span class="dd-status-badge dd-status-badge--pending">Pendiente</span>
        </div>
      </div>
      <div class="dd-meta-chips">
        ${taskTitle  ? `<span class="dd-chip">${_esc(taskTitle)}</span>` : ""}
        ${subject    ? `<span class="dd-chip">${_esc(subject)}</span>`   : ""}
      </div>
    </div>
    <div class="dd-body" style="padding:20px;color:rgba(242,237,229,0.40);font-size:13px;">
      El alumno aún no ha trabajado esta tarea con el tutor IA.
    </div>`;
  _drawer.querySelector(".dd-close").addEventListener("click", closeSessionDrawer);
}

// ── Full mode: con sesión IA ──────────────────────────────────────────────

function _renderFull(data, onMarcarRevisado) {
  const { session, student, task, stepMap, messages, note } = data;

  const statusBadge = session.needs_help
    ? `<span class="dd-status-badge dd-status-badge--help">Necesitó ayuda</span>`
    : `<span class="dd-status-badge dd-status-badge--done">Resolvió solo</span>`;

  const stepsHtml = stepMap.steps.length
    ? `<ul class="dd-steps-list">${stepMap.steps.map(s => {
        let cls = "dd-step";
        let icon = "○";
        if (s.completed) {
          cls += " dd-step--done"; icon = "✓";
        } else if (s.index === stepMap.currentStep && session.needs_help) {
          cls += " dd-step--stuck"; icon = "⚠";
        } else if (s.index === stepMap.currentStep) {
          cls += " dd-step--current"; icon = "→";
        }
        return `<li class="${cls}"><span class="dd-step-icon">${icon}</span><span>${_esc(s.title)}</span></li>`;
      }).join("")}</ul>`
    : `<p style="font-size:12px;color:rgba(242,237,229,0.28);margin:0">Sin mapa de pasos disponible.</p>`;

  const msgsHtml = messages.length
    ? `<div class="dd-messages">${messages.map(m =>
        `<div class="dd-bubble dd-bubble--${m.role === "user" ? "user" : "assistant"}">${_esc(m.content)}</div>`
      ).join("")}</div>`
    : `<p class="dd-messages-empty">Sin mensajes guardados.</p>`;

  const noteHtml = note
    ? `<div class="dd-section">
        <div class="dd-section-title">Nota del alumno</div>
        <div class="dd-note-label">Nota personal</div>
        <div class="dd-note-block">${_esc(note.note_text)}</div>
       </div>`
    : "";

  const btnLabel = note && note.is_read ? "Revisado ✓" : "Marcar como revisado";

  _drawer.innerHTML = `
    <button class="dd-close" aria-label="Cerrar">✕</button>
    <div class="dd-header">
      <div class="dd-header-top">
        <div class="dd-avatar">${_initials(student.name)}</div>
        <div>
          <div class="dd-student-name">${_esc(student.name)}</div>
          ${statusBadge}
        </div>
      </div>
      <div class="dd-meta-chips">
        ${task.subject_name ? `<span class="dd-chip">${_esc(task.subject_name)}</span>` : ""}
        ${task.title        ? `<span class="dd-chip">${_esc(task.title)}</span>`        : ""}
        ${_fmtDate(session.session_date) !== "—" ? `<span class="dd-chip">${_esc(_fmtDate(session.session_date))}</span>` : ""}
        ${session.duration_seconds ? `<span class="dd-chip dd-chip--copper">${_fmtTime(session.duration_seconds)}</span>` : ""}
      </div>
    </div>
    <div class="dd-body">
      ${noteHtml}
      <div class="dd-section">
        <div class="dd-section-title">Recorrido del ejercicio</div>
        ${stepsHtml}
      </div>
      <div class="dd-section">
        <div class="dd-section-title">Conversación con el tutor</div>
        ${msgsHtml}
      </div>
    </div>
    <div class="dd-footer">
      <button class="dd-btn-primary" id="ddBtnRevisar" ${note?.is_read ? "disabled" : ""}>${btnLabel}</button>
      <button class="dd-btn-ghost" disabled>Mensaje al alumno</button>
    </div>`;

  _drawer.querySelector(".dd-close").addEventListener("click", closeSessionDrawer);
  _drawer.querySelector("#ddBtnRevisar").addEventListener("click", () => {
    if (note?.id) onMarcarRevisado(note.id);
  });
}

// ── Punto de entrada ──────────────────────────────────────────────────────

export async function openSessionDrawer(ctx, { studentId, dayKey, taskTitle, sessionId, readonly = false }) {
  _init();

  const student = normalizeStudent(ctx.state.data.students?.find(s => s.id === studentId));
  const studentName = student ? formatStudentName(student) : "Alumno";

  // Abrir inmediatamente con estado de carga
  _backdrop.classList.add("is-open");
  _drawer.classList.add("is-open");
  _drawer.innerHTML = `
    <button class="dd-close" aria-label="Cerrar">✕</button>
    <div class="dd-loading"><div class="dd-spinner"></div> Cargando detalle…</div>`;
  _drawer.querySelector(".dd-close").addEventListener("click", closeSessionDrawer);

  // Si no hay sessionId (punto gris = pendiente), mostrar vista simplificada
  if (!sessionId) {
    const task = (ctx.state.data.weekTasks || ctx.state.data.tasks || []).find(t => t.title === taskTitle);
    _renderPending({ studentName, taskTitle, subject: task?.subjectName || "" });
    return;
  }

  try {
    const res  = await apiFetch(`/api/v1/session/${encodeURIComponent(sessionId)}/detail`);
    const body = await res.json().catch(() => ({}));

    if (!res.ok) {
      _drawer.innerHTML = `<button class="dd-close" aria-label="Cerrar">✕</button>
        <div class="dd-error">No se pudo cargar el detalle (${res.status}).</div>`;
      _drawer.querySelector(".dd-close").addEventListener("click", closeSessionDrawer);
      return;
    }

    const data = body?.data || {};
    _currentNoteId = data.note?.id || null;

    _renderFull(data, async (noteId) => {
      const btn = _drawer.querySelector("#ddBtnRevisar");
      if (btn) { btn.disabled = true; btn.textContent = "Guardando…"; }

      try {
        await apiFetch(`/api/v1/student-notes/${encodeURIComponent(noteId)}`, {
          method:  "PATCH",
          headers: { "Content-Type": "application/json" },
          body:    JSON.stringify({ is_read: true }),
        });
        if (btn) btn.textContent = "Revisado ✓";

        // Eliminar indicador de nota no leída en el dot correspondiente
        if (sessionId) {
          const wrap = document.querySelector(`.nbDot-wrap[data-session-id="${sessionId}"]`);
          wrap?.querySelector(".nbDot-unread")?.remove();
        }
        // Actualizar estado en memoria
        if (ctx.state.data.studentNotes) {
          const n = ctx.state.data.studentNotes.find(x => x.id === noteId);
          if (n) n.is_read = true;
        }
      } catch {
        if (btn) { btn.disabled = false; btn.textContent = "Marcar como revisado"; }
      }
    });
  } catch {
    _drawer.innerHTML = `<button class="dd-close" aria-label="Cerrar">✕</button>
      <div class="dd-error">Error de conexión.</div>`;
    _drawer.querySelector(".dd-close").addEventListener("click", closeSessionDrawer);
  }
}

function _esc(str) {
  return String(str || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
