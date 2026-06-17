// trimestreGradesSheet.js — "Exámenes/Trabajos → Ver" sub-view: read-only
// list of grades for one type, swapped into the same Level-2 sheet (with a
// back arrow). No input, no save — mirrors desktop's readOnly grade-drawer.

const SVG_BACK  = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" aria-hidden="true"><polyline points="15 18 9 12 15 6"/></svg>`;
const SVG_CLOSE = `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" aria-hidden="true"><path d="M18 6 6 18M6 6l12 12"/></svg>`;

const TYPE_LABEL = { exam: "Exámenes", work: "Trabajos" };

function _esc(s) { return String(s || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;"); }

function _rowHtml(grade) {
  return `
    <li class="mt-tl-item">
      <span class="mt-grade-score">${_esc(grade.score)}</span>
      <div class="mt-tl-info">
        <span class="mt-tl-title">${_esc(grade._taskTitle || grade.title || "Tarea")}</span>
        ${grade.date ? `<span class="mt-tl-date">${_esc(grade.date)}</span>` : ""}
      </div>
    </li>`;
}

export function renderTrimestreGrades({ contentEl, studentName, type, grades, onBack, onClose }) {
  contentEl.innerHTML = `
    <div class="mt-sheet-header">
      <button class="mt-sheet-close" id="mtGrBack" aria-label="Volver">${SVG_BACK}</button>
      <span class="mt-sheet-title">${_esc(TYPE_LABEL[type] || "Notas")} · ${_esc(studentName)}</span>
      <button class="mt-sheet-close" id="mtGrClose" aria-label="Cerrar">${SVG_CLOSE}</button>
    </div>
    <div class="mt-sheet-body">
      ${grades.length === 0
        ? `<div class="mt-loading">Sin notas.</div>`
        : `<ul class="mt-tl-list">${grades.map(_rowHtml).join("")}</ul>`}
    </div>`;

  contentEl.querySelector("#mtGrBack").addEventListener("click", onBack);
  contentEl.querySelector("#mtGrClose").addEventListener("click", onClose);
}
