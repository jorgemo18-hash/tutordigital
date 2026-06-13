// session-drawer-render.js — renderizadores puros del drawer de sesión.
// Todos reciben dependencias como parámetros; no cierran sobre variables externas.

import { apiFetch } from "../../shared/js/auth.js";
import { renderNotebook } from "./notebook.js";

// ── SVG icons ─────────────────────────────────────────────────────────────

export const SVG_CHECK = `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="20 6 9 17 4 12"/></svg>`;
export const SVG_X     = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" aria-hidden="true"><path d="M18 6 6 18M6 6l12 12"/></svg>`;
export const SVG_CLOSE = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M18 6 6 18M6 6l12 12"/></svg>`;
export const SVG_SPARK = `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M13 3l2.2 5.8L21 11l-5.8 2.2L13 19l-2.2-5.8L5 11l5.8-2.2L13 3z"/></svg>`;
export const SVG_ARROW = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>`;

// ── Pure helpers ───────────────────────────────────────────────────────────

export function esc(str) {
  return String(str || "")
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

export function fmtTime(secs) {
  if (!secs) return "—";
  const m = Math.round(secs / 60);
  if (m < 1)  return "< 1m";
  return m >= 60 ? `${Math.floor(m / 60)}h${m % 60 ? ` ${m % 60}m` : ""}` : `${m}m`;
}

export function fmtDate(iso) {
  if (!iso) return "—";
  try {
    const d = new Date(iso + "T12:00:00");
    const day = d.toLocaleDateString("es-ES", { weekday: "long" });
    return `${day.charAt(0).toUpperCase() + day.slice(1)} · ${d.getDate()} ${d.toLocaleDateString("es-ES", { month: "long" })}`;
  } catch { return iso; }
}

export function fmtDateFromKey(iso) {
  try {
    const d = new Date(iso + "T12:00:00");
    return d.toLocaleDateString("es-ES", { weekday: "long", day: "numeric", month: "long" }).replace(/^\w/, c => c.toUpperCase());
  } catch { return iso; }
}

// ── Step rendering ─────────────────────────────────────────────────────────

export function stepState(step, currentStep) {
  if (step.completed)           return "bien";
  if (step.index === currentStep) return "atasco";
  if (step.index  > currentStep) return "nollego";
  return "nollego";
}

const STEP_TAG = { bien: "bien", atasco: "se atascó aquí", error: "error", nollego: "no llegó" };

function _stepMark(st) {
  if (st === "bien")   return SVG_CHECK;
  if (st === "error")  return SVG_X;
  if (st === "atasco") return `<span class="dd-step-ring"></span>`;
  return `<span class="dd-step-hollow"></span>`;
}

// ── Renderizadores reutilizables de pasos y chat ──────────────────────────

export function renderStepsHtml(stepMap) {
  if (!stepMap?.steps?.length) {
    return `<div class="dd-empty-line">Sin mapa de pasos disponible.</div>`;
  }
  return `<ol class="dd-steps">${stepMap.steps.map(s => {
    const st   = stepState(s, stepMap.currentStep);
    const mark = _stepMark(st);
    const tag  = STEP_TAG[st] || st;
    return `<li class="dd-step ${st}">
      <span class="dd-step-mark">${mark}</span>
      <span class="dd-step-txt">${esc(s.title)}</span>
      <span class="dd-step-tag">${esc(tag)}</span>
    </li>`;
  }).join("")}</ol>`;
}

export function renderChatHtml(messages) {
  if (!messages?.length) {
    return `<div class="dd-empty-line">Sin conversación guardada.</div>`;
  }
  return `<div class="dd-chat">${messages.map(m => {
    const who    = m.role === "user" ? "alumno" : "tutor";
    const aiIcon = who === "tutor" ? `<span class="dd-msg-ai">${SVG_SPARK}</span>` : "";
    return `<div class="dd-msg ${who}">${aiIcon}<div class="dd-bubble">${esc(m.content)}</div></div>`;
  }).join("")}</div>`;
}

// ── renderFull ─────────────────────────────────────────────────────────────
// Renders the full single-session detail view.
// panel:      the .dd-panel DOM element
// closeDrawer: the closeSessionDrawer function
// data:       { session, student, task, stepMap, messages, note }
// ctx:        teacher app context
// opts:       { dotColor, isAlreadyReviewed }

export function renderFull(panel, closeDrawer, data, ctx, { dotColor = "pending", isAlreadyReviewed = false } = {}) {
  const session  = data.session  || {};
  const student  = data.student  || { name: "Alumno" };
  const task     = data.task     || {};
  const stepMap  = data.stepMap  || { steps: [], currentStep: 0 };
  const messages = Array.isArray(data.messages) ? data.messages : [];
  const note     = data.note     || null;
  const isCompleted = dotColor === "done" || dotColor === "needs";

  const statusClass = session.needs_help ? "help" : "solo";
  const statusLabel = session.needs_help ? "Necesitó ayuda" : "Resolvió solo";
  const intentos    = messages.filter(m => m.role === "user").length;

  const stepsHtml = renderStepsHtml(stepMap);
  const chatHtml  = renderChatHtml(messages);

  const vistoBtn = note && !note.is_read
    ? `<button class="dd-note-visto" id="ddBtnVisto">Visto ✓</button>`
    : (note?.is_read ? `<span class="dd-note-leida">Leído ✓</span>` : "");

  const noteHtml = note
    ? `<section class="dd-sect">
        <div class="dd-sect-eye"><span class="bar copper"></span>Nota del alumno${vistoBtn}</div>
        <div class="dd-note"><span class="dd-note-quote">❝</span><p>${esc(note.note_text)}</p></div>
       </section>`
    : `<section class="dd-sect">
        <div class="dd-sect-eye"><span class="bar dim"></span>Nota del alumno</div>
        <div class="dd-empty-line">El alumno no dejó ninguna nota.</div>
       </section>`;

  const btnRevisado = !isCompleted
    ? `<button class="dd-fbtn solid" id="ddBtnRevisar" disabled>Pendiente de completar</button>`
    : isAlreadyReviewed
      ? `<button class="dd-fbtn solid" id="ddBtnRevisar" disabled>Revisado ✓ ${SVG_ARROW}</button>`
      : `<button class="dd-fbtn solid" id="ddBtnRevisar">Marcar como revisado ${SVG_ARROW}</button>`;

  panel.innerHTML = `
    <header class="dd-head">
      <div class="dd-head-top">
        <span class="dd-status ${statusClass}">
          <span class="dd-status-dot"></span>${statusLabel}
        </span>
        <button class="dd-close" aria-label="Cerrar">${SVG_CLOSE}</button>
      </div>
      <h2 class="dd-name">${esc(student.name)}</h2>
      <div class="dd-meta">
        <span>${esc(fmtDate(session.session_date))}</span>
        ${task.title ? `<span class="dd-dot-sep"></span><span>${esc(task.title)}</span>` : ""}
      </div>
      <div class="dd-chips">
        ${task.subject_name        ? `<span class="dd-chip"><em>Asignatura</em>${esc(task.subject_name)}</span>` : ""}
        ${session.duration_seconds ? `<span class="dd-chip"><em>Tiempo</em>${fmtTime(session.duration_seconds)}</span>` : ""}
        ${intentos > 0             ? `<span class="dd-chip"><em>Intentos</em>${intentos}</span>` : ""}
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

  panel.querySelector(".dd-close").addEventListener("click", closeDrawer);

  async function _markNoteRead() {
    if (!note?.id) return false;
    const res = await apiFetch(`/api/v1/student-notes/${encodeURIComponent(note.id)}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ is_read: true }),
    });
    if (!res.ok) return false;
    if (ctx?.state?.data?.studentNotes) {
      const n = ctx.state.data.studentNotes.find(n => n.id === note.id);
      if (n) n.is_read = true;
    }
    if (ctx) renderNotebook(ctx);
    return true;
  }

  async function _markSessionReviewed() {
    if (note?.id) {
      const noteRes = await apiFetch(`/api/v1/student-notes/${encodeURIComponent(note.id)}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ is_read: true }),
      });
      if (!noteRes.ok) return false;
      if (ctx?.state?.data?.studentNotes) {
        const n = ctx.state.data.studentNotes.find(n => n.id === note.id);
        if (n) n.is_read = true;
      }
    }
    const sessRes = await apiFetch(`/api/v1/tutor-sessions/${encodeURIComponent(session.id)}/review`, { method: "PATCH" });
    if (!sessRes.ok) return false;
    if (ctx?.state?.data?.tutorSessions) {
      ctx.state.data.tutorSessions.forEach(s => {
        if (s.student_id === student.id && s.task_id === task.id && s.session_date === session.session_date) {
          s.teacher_reviewed = true;
        }
      });
    }
    if (ctx) renderNotebook(ctx);
    return true;
  }

  const btnVisto = panel.querySelector("#ddBtnVisto");
  if (btnVisto) {
    btnVisto.addEventListener("click", async () => {
      btnVisto.disabled = true;
      btnVisto.textContent = "…";
      try {
        await _markNoteRead();
        btnVisto.textContent = "Leído ✓";
        btnVisto.classList.add("dd-note-leida-inline");
        const btnR = panel.querySelector("#ddBtnRevisar");
        if (btnR && isCompleted) { btnR.innerHTML = `Revisado ✓ ${SVG_ARROW}`; btnR.disabled = true; }
      } catch {
        btnVisto.disabled = false;
        btnVisto.textContent = "Visto ✓";
      }
    });
  }

  const btnRevisar = panel.querySelector("#ddBtnRevisar");
  if (btnRevisar && isCompleted && !isAlreadyReviewed) {
    btnRevisar.addEventListener("click", async () => {
      btnRevisar.disabled = true;
      btnRevisar.textContent = "Guardando…";
      try {
        await _markSessionReviewed();
        btnRevisar.innerHTML = `Revisado ✓ ${SVG_ARROW}`;
        const bv = panel.querySelector("#ddBtnVisto");
        if (bv) { bv.textContent = "Leído ✓"; bv.disabled = true; }
      } catch {
        btnRevisar.disabled = false;
        btnRevisar.innerHTML = `Marcar como revisado ${SVG_ARROW}`;
      }
    });
  }
}
