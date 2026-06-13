// task-list-drawer.js — Level-1 drawer: lista de tareas del trimestre para un alumno.
// Al pulsar "Ver" en una tarea abre el session-drawer (Level 2) en modo apilado.

import { openSessionDrawer, closeSessionDrawer } from "../session-drawer.js";

// ── Singleton DOM ──────────────────────────────────────────────────────────
let _overlay = null;
let _panel   = null;
let _ctx     = null;

const SVG_CLOSE = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"
  stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M18 6 6 18M6 6l12 12"/></svg>`;

function _init() {
  if (_overlay) return;

  _overlay = document.createElement("div");
  _overlay.className = "tl-overlay";
  _overlay.addEventListener("click", closeTaskListDrawer);

  _panel = document.createElement("aside");
  _panel.className = "tl-panel";
  _panel.setAttribute("role", "dialog");
  _panel.setAttribute("aria-modal", "true");
  _panel.setAttribute("aria-label", "Tareas del trimestre");
  _panel.addEventListener("click", e => e.stopPropagation());

  _overlay.appendChild(_panel);
  document.body.appendChild(_overlay);

  document.addEventListener("keydown", e => {
    if (e.key === "Escape" && _overlay?.classList.contains("open")) closeTaskListDrawer();
  });

  // When Level 2 (session) closes on its own, remove stacked offset from Level 1
  document.addEventListener("sessionDrawerClosed", () => {
    if (_overlay?.classList.contains("open")) {
      _panel?.classList.remove("is-stacked");
    }
  });
}

function _esc(s) {
  return String(s ?? "")
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

export function closeTaskListDrawer() {
  // Remove open/stacked from Level 1 first (prevents double-transition glitch)
  _overlay?.classList.remove("open");
  _panel?.classList.remove("open", "is-stacked");
  // Then close Level 2 (session) — event fires but handler sees overlay not open → no-op
  closeSessionDrawer();
  _ctx = null;
}

export function openTaskListDrawer(ctx, { studentId, studentName, progressTasks }) {
  _init();
  _ctx = ctx;

  const dotClass = { resolved: "nbProgStatus--resolved", help: "nbProgStatus--help", pending: "nbProgStatus--pend" };
  const dotColor = { resolved: "done", help: "needs", pending: "pending" };

  _panel.innerHTML = `
    <div class="tl-head">
      <div class="tl-head-top">
        <div class="tl-student">
          <span class="tl-student-name">${_esc(studentName)}</span>
          <span class="tl-student-sub">Tareas del trimestre</span>
        </div>
        <button class="dd-close" id="tlCloseBtn" type="button" aria-label="Cerrar">${SVG_CLOSE}</button>
      </div>
    </div>
    <div class="tl-body">
      ${progressTasks.length === 0
        ? `<p class="tl-empty">Sin tareas en el trimestre.</p>`
        : `<ul class="tl-list">${progressTasks.map(pt => `
          <li class="tl-item">
            <span class="nbProgStatus ${dotClass[pt.status] || "nbProgStatus--pend"}"></span>
            <div class="tl-task-info">
              <span class="tl-task-title">${_esc(pt.taskTitle)}</span>
              ${pt.sessionDate ? `<span class="tl-task-date">${_esc(pt.sessionDate)}</span>` : ""}
            </div>
            <button class="nbVerBtn" type="button"
              data-tl-action="view-session"
              data-student-id="${_esc(studentId)}"
              data-session-id="${_esc(pt.sessionId || "")}"
              data-task-id="${_esc(pt.taskId || "")}"
              data-day-key="${_esc(pt.sessionDate || "")}"
              data-task-title="${_esc(pt.taskTitle)}"
              data-dot-color="${dotColor[pt.status] || "pending"}"
              data-is-reviewed="${pt.isReviewed ? "true" : "false"}"
            >Ver</button>
          </li>`).join("")}</ul>`
      }
    </div>
  `;

  _panel.querySelector("#tlCloseBtn").addEventListener("click", closeTaskListDrawer);

  _panel.querySelector(".tl-body")?.addEventListener("click", e => {
    const btn = e.target.closest("[data-tl-action='view-session']");
    if (!btn) return;
    e.stopPropagation();
    // Shift Level 1 left to reveal Level 2 panel beside it
    _panel.classList.add("is-stacked");
    openSessionDrawer(ctx, {
      studentId:         btn.dataset.studentId,
      dayKey:            btn.dataset.dayKey || "",
      taskTitle:         btn.dataset.taskTitle || "",
      sessionId:         btn.dataset.sessionId || null,
      taskId:            btn.dataset.taskId    || null,
      readonly:          true,
      dotColor:          btn.dataset.dotColor || "pending",
      isAlreadyReviewed: btn.dataset.isReviewed === "true",
      stacked:           true,
    });
  });

  _overlay.classList.add("open");
  _panel.classList.add("open");
}
