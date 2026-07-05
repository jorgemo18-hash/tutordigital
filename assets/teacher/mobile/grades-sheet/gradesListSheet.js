// gradesListSheet.js — Generic read-only list of grades with inline
// "Editar" (score input) and "×" (delete with confirmation) actions, same
// endpoints as desktop's grade-drawer.js (PATCH/DELETE /api/v1/grades/:id).
// No "add new grade" form. Used by both the Trimestre card's
// Exámenes/Trabajos → Ver sheet and the Semana card's "Notas" button —
// callers supply the title and the (already filtered) grades array.

import { parseScore } from "../../js/features/scoreValidation.js";
import { mtPatchGrade, mtDeleteGrade } from "./gradesData.js";
import { escHtml as _esc } from "../../../shared/js/escHtml.js";

const SVG_BACK  = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" aria-hidden="true"><polyline points="15 18 9 12 15 6"/></svg>`;
const SVG_CLOSE = `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" aria-hidden="true"><path d="M18 6 6 18M6 6l12 12"/></svg>`;

function _rowHtml(grade, editing) {
  const leftHtml = editing
    ? `<input class="mt-grade-edit-input" type="text" value="${_esc(grade.score)}" autocomplete="off" />`
    : `<span class="mt-grade-score">${_esc(grade.score)}</span>`;
  const actionsHtml = editing
    ? `<button class="mt-ver-btn" type="button" data-grade-action="save">Guardar</button>
       <button class="mt-ver-btn" type="button" data-grade-action="cancel">Cancelar</button>`
    : `<button class="mt-ver-btn" type="button" data-grade-action="edit">Editar</button>
       <button class="mt-grade-del" type="button" data-grade-action="delete" aria-label="Eliminar nota">×</button>`;
  return `
    <li class="mt-tl-item" data-grade-id="${_esc(grade.id)}">
      ${leftHtml}
      <div class="mt-tl-info">
        <span class="mt-tl-title">${_esc(grade._taskTitle || grade.title || "Tarea")}</span>
        ${grade.date ? `<span class="mt-tl-date">${_esc(grade.date)}</span>` : ""}
      </div>
      <div class="mt-grade-actions">${actionsHtml}</div>
    </li>`;
}

export function renderGradesList({ contentEl, title, grades, apiFetch, onBack, onClose }) {
  let editingId = null;

  function draw() {
    contentEl.innerHTML = `
      <div class="mt-sheet-header">
        <button class="mt-sheet-close" id="mtGrBack" aria-label="Volver">${SVG_BACK}</button>
        <span class="mt-sheet-title">${_esc(title)}</span>
        <button class="mt-sheet-close" id="mtGrClose" aria-label="Cerrar">${SVG_CLOSE}</button>
      </div>
      <div class="mt-sheet-body">
        ${grades.length === 0
          ? `<div class="mt-loading">Sin notas todavía.</div>`
          : `<ul class="mt-tl-list">${grades.map(g => _rowHtml(g, g.id === editingId)).join("")}</ul>`}
      </div>`;

    contentEl.querySelector("#mtGrBack").addEventListener("click", onBack);
    contentEl.querySelector("#mtGrClose").addEventListener("click", onClose);
    contentEl.querySelectorAll("[data-grade-action]").forEach(btn => {
      btn.addEventListener("click", () => _handleAction(btn));
    });
  }

  async function _handleAction(btn) {
    const li      = btn.closest("[data-grade-id]");
    const gradeId = li?.dataset.gradeId;
    const grade   = grades.find(g => g.id === gradeId);
    if (!grade) return;
    const action = btn.dataset.gradeAction;

    if (action === "edit")   { editingId = gradeId; draw(); return; }
    if (action === "cancel") { editingId = null; draw(); return; }

    if (action === "delete") {
      if (!confirm("¿Eliminar esta nota?")) return;
      const ok = await mtDeleteGrade(apiFetch, gradeId);
      if (!ok) return;
      const idx = grades.findIndex(g => g.id === gradeId);
      if (idx >= 0) grades.splice(idx, 1);
      draw();
      return;
    }

    if (action === "save") {
      const input  = li.querySelector(".mt-grade-edit-input");
      const parsed = parseScore(input.value);
      if (!parsed.valid || parsed.empty) { input.classList.add("mt-grade-edit-input--error"); input.focus(); return; }
      const ok = await mtPatchGrade(apiFetch, gradeId, parsed.normalized);
      if (!ok) return;
      grade.score = parsed.normalized;
      editingId = null;
      draw();
    }
  }

  draw();
}
