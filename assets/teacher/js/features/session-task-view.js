// session-task-view.js — Vista de tarea multi-sesión en el drawer profesor.
// Renderiza lista colapsable de sesiones con badge por outcome + carga lazy de detalle.

import { apiFetch } from "../../../shared/js/auth.js";
import {
  SVG_CLOSE, esc, fmtTime, fmtDateFromKey,
  renderStepsHtml, renderChatHtml,
} from "../session-drawer-render.js";
import { renderNotebook } from "../notebook.js";

// ── Marcar revisado (compartido: botón manual + auto al abrir desde el
// indicador de pendientes, ver notebook-review-popover.js) ─────────────────

export async function markTaskSessionsReviewed(ctx, sessions) {
  const pending = sessions.filter(s => !s.teacher_reviewed);
  if (!pending.length) return;
  await Promise.all(pending.map(s =>
    apiFetch(`/api/v1/tutor-sessions/${encodeURIComponent(s.id)}/review`, { method: "PATCH" })
  ));
  const reviewedIds = new Set(sessions.map(s => s.id));
  if (ctx?.state?.data?.tutorSessions) {
    ctx.state.data.tutorSessions.forEach(s => {
      if (reviewedIds.has(s.id)) s.teacher_reviewed = true;
    });
  }
}

// ── Badge por outcome ──────────────────────────────────────────────────────

function _badge(s) {
  if (s.needs_help || s.outcome === "abandoned") return { cls: "help", label: "Necesitó ayuda" };
  if (s.outcome === "in_progress")               return { cls: "warn", label: "En curso" };
  if (s.outcome === "completed") {
    if (s.step_count > 0 && s.current_step < s.step_count - 1)
      return { cls: "warn", label: "Resuelto (parcial)" };
    return { cls: "solo", label: "Resuelto solo" };
  }
  return { cls: "pend", label: "Pendiente" };
}

// ── Helpers de presentación ────────────────────────────────────────────────

function _exerciseLabel(s, idx) {
  if (s.exercise_title) {
    return s.exercise_index != null
      ? `Ejercicio ${s.exercise_index}: ${s.exercise_title}`
      : s.exercise_title;
  }
  return s.exercise_index != null ? `Ejercicio ${s.exercise_index}` : `Sesión ${idx + 1}`;
}

function _plural(n, singular, plural) {
  return n === 1 ? `${n} ${singular}` : `${n} ${plural}`;
}

function _summaryHtml(sessions, totalExercises) {
  const worked   = sessions.length;
  const resolved = sessions.filter(s => s.outcome === "completed").length;
  const needHelp = sessions.filter(s => s.outcome === "abandoned" || s.needs_help).length;
  const totalStr = totalExercises ? ` de ${totalExercises}` : "";
  return `<div class="dd-task-summary">
    <span class="dd-task-summary-count">${_plural(worked, "ejercicio", "ejercicios")} trabajado${worked !== 1 ? "s" : ""}${totalStr}</span>
    <span class="dd-task-summary-pills">
      ${resolved ? `<span class="dd-sum-pill solo">${_plural(resolved, "resuelto", "resueltos")}</span>` : ""}
      ${needHelp ? `<span class="dd-sum-pill help">${needHelp} con ayuda</span>` : ""}
    </span>
  </div>`;
}

// ── Expand / colapso de fila ───────────────────────────────────────────────

async function _toggleSession(rowEl, sessionId) {
  const isOpen  = rowEl.classList.contains("dd-acc--open");
  const headBtn = rowEl.querySelector(".dd-acc-head");
  const bodyEl  = rowEl.querySelector(".dd-acc-body");
  if (!bodyEl) return;

  if (isOpen) {
    rowEl.classList.remove("dd-acc--open");
    headBtn?.setAttribute("aria-expanded", "false");
    return;
  }

  rowEl.classList.add("dd-acc--open");
  headBtn?.setAttribute("aria-expanded", "true");

  if (bodyEl.dataset.loaded === "true") return;

  bodyEl.innerHTML = `<div class="dd-acc-loading"><div class="dd-spinner"></div>Cargando…</div>`;

  try {
    const res  = await apiFetch(`/api/v1/session/${encodeURIComponent(sessionId)}/detail`);
    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      bodyEl.innerHTML = `<div class="dd-acc-error">Error al cargar (${res.status}).</div>`;
      return;
    }

    const { stepMap = { steps: [], currentStep: 0 }, messages = [] } = data?.data || {};
    bodyEl.innerHTML = `<div class="dd-acc-detail">
      <div class="dd-acc-sect">
        <div class="dd-sect-eye"><span class="bar copper"></span>Recorrido del ejercicio</div>
        ${renderStepsHtml(stepMap)}
      </div>
      <div class="dd-acc-sect">
        <div class="dd-sect-eye"><span class="bar copper"></span>Conversación</div>
        ${renderChatHtml(messages)}
      </div>
    </div>`;
    bodyEl.dataset.loaded = "true";
  } catch {
    bodyEl.innerHTML = `<div class="dd-acc-error">Error de conexión.</div>`;
  }
}

// ── Renderizador principal ─────────────────────────────────────────────────

export function renderTaskView(panel, closeDrawer, sessions, opts, ctx, { isAlreadyReviewed = false, autoMarkReviewed = false } = {}) {
  const { studentName, taskTitle, taskObj, dayKey, totalExercises = 0 } = opts;
  const subject = taskObj?.subject_name || taskObj?.subjectName || "";

  const SVG_CHEVRON = `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor"
    stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
    <polyline points="9 18 15 12 9 6"/></svg>`;

  const listHtml = sessions.map((s, i) => {
    const badge = _badge(s);
    const label = _exerciseLabel(s, i);
    const date  = s.session_date ? fmtDateFromKey(s.session_date) : "";
    const chips = [
      s.duration_seconds ? fmtTime(s.duration_seconds) : null,
      s.message_count > 0 ? `${s.message_count} msj.` : null,
    ].filter(Boolean).join(" · ");

    return `<div class="dd-acc" data-session-id="${esc(s.id)}">
      <button class="dd-acc-head" type="button" aria-expanded="false">
        <span class="dd-acc-label">${esc(label)}</span>
        <span class="dd-acc-right">
          ${date  ? `<span class="dd-acc-date">${esc(date)}</span>` : ""}
          ${chips ? `<span class="dd-acc-chips">${esc(chips)}</span>` : ""}
          <span class="dd-status-inline ${badge.cls}">${esc(badge.label)}</span>
          <span class="dd-acc-chevron">${SVG_CHEVRON}</span>
        </span>
      </button>
      <div class="dd-acc-body"></div>
    </div>`;
  }).join("");

  const reviewBtn = isAlreadyReviewed
    ? `<button class="dd-fbtn solid" id="ddTaskRevisar" disabled>Revisado ✓</button>`
    : `<button class="dd-fbtn solid" id="ddTaskRevisar">Marcar como revisado</button>`;

  panel.innerHTML = `
    <header class="dd-head">
      <div class="dd-head-top">
        <span class="dd-status pend"><span class="dd-status-dot"></span>Historial de ejercicios</span>
        <button class="dd-close" aria-label="Cerrar">${SVG_CLOSE}</button>
      </div>
      <h2 class="dd-name">${esc(studentName)}</h2>
      <div class="dd-meta">
        ${dayKey ? `<span>${esc(fmtDateFromKey(dayKey))}</span><span class="dd-dot-sep"></span>` : ""}
        <span>${esc(taskTitle || "Tarea")}</span>
      </div>
      ${subject ? `<div class="dd-chips"><span class="dd-chip"><em>Asignatura</em>${esc(subject)}</span></div>` : ""}
    </header>
    ${_summaryHtml(sessions, totalExercises)}
    <div class="dd-body dd-body--acc">
      ${sessions.length
        ? `<div class="dd-acc-list">${listHtml}</div>`
        : `<div class="dd-empty-line">Sin sesiones registradas.</div>`}
    </div>
    <footer class="dd-foot">${reviewBtn}</footer>`;

  panel.querySelector(".dd-close").addEventListener("click", closeDrawer);

  panel.querySelectorAll(".dd-acc-head").forEach(btn => {
    btn.addEventListener("click", () => {
      const rowEl    = btn.closest(".dd-acc");
      const sessionId = rowEl?.dataset.sessionId;
      if (sessionId) _toggleSession(rowEl, sessionId);
    });
  });

  const revBtn = panel.querySelector("#ddTaskRevisar");
  if (revBtn && !isAlreadyReviewed) {
    revBtn.addEventListener("click", async () => {
      revBtn.disabled = true;
      revBtn.textContent = "Guardando…";
      try {
        await markTaskSessionsReviewed(ctx, sessions);
        revBtn.innerHTML = "Revisado ✓";
        if (ctx) renderNotebook(ctx);
      } catch {
        revBtn.disabled = false;
        revBtn.textContent = "Marcar como revisado";
      }
    });
  }

  // Abierto desde el indicador de pendientes (badge del Cuaderno): la propia
  // acción de abrir cuenta como revisión, sin exigir el click extra del botón.
  if (autoMarkReviewed && !isAlreadyReviewed && revBtn) {
    markTaskSessionsReviewed(ctx, sessions)
      .then(() => {
        revBtn.disabled = true;
        revBtn.innerHTML = "Revisado ✓";
        if (ctx) renderNotebook(ctx);
      })
      .catch(() => {}); // el botón manual sigue disponible si esto falla
  }
}
