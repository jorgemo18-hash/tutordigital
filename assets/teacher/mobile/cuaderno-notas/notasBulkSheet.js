// notasBulkSheet.js — Level 2 of "Poner notas": one row per student with a
// score input, validated with the same parseScore (0-10) used everywhere
// else. "Guardar todo" calls the same PATCH /api/v1/grades/bulk as
// desktop's bulk-grade-drawer.js. Empty inputs are skipped on save.

import { parseScore } from "../../js/features/scoreValidation.js";
import { mtFetchGradesForTask, mtSaveBulkGrades } from "./notasData.js";
import { escHtml as _esc } from "../../../shared/js/escHtml.js";

const SVG_BACK  = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" aria-hidden="true"><polyline points="15 18 9 12 15 6"/></svg>`;
const SVG_CLOSE = `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" aria-hidden="true"><path d="M18 6 6 18M6 6l12 12"/></svg>`;

function _rowHtml(student, existingScore) {
  return `
    <li class="mt-notas-srow" data-student-id="${_esc(student.id)}">
      <span class="mt-notas-sname">${_esc(student.name)}</span>
      <input class="mt-notas-input" type="text" inputmode="decimal"
             value="${_esc(existingScore || "")}" placeholder="—" autocomplete="off" />
    </li>`;
}

function _validateAll(listEl, saveBtn) {
  let allValid = true;
  listEl.querySelectorAll(".mt-notas-input").forEach(input => {
    const parsed = parseScore(input.value);
    input.classList.toggle("mt-notas-input--error", !parsed.valid);
    if (!parsed.valid) allValid = false;
  });
  saveBtn.disabled = !allValid;
}

export async function renderNotasBulkSheet({ contentEl, task, students, apiFetch, onBack, onClose, onSaved }) {
  contentEl.innerHTML = `
    <div class="mt-sheet-header">
      <button class="mt-sheet-close" id="mtNbBack" aria-label="Volver">${SVG_BACK}</button>
      <span class="mt-sheet-title">${_esc(task.title || "Tarea")}</span>
      <button class="mt-sheet-close" id="mtNbClose" aria-label="Cerrar">${SVG_CLOSE}</button>
    </div>
    <div class="mt-sheet-body">
      <ul class="mt-notas-list" id="mtNbList"><li class="mt-loading">Cargando…</li></ul>
    </div>
    <div class="mt-sheet-footer">
      <button class="mt-btn mt-btn--primary" type="button" id="mtNbSaveBtn" style="width:100%" disabled>Guardar todo</button>
    </div>`;

  const listEl  = contentEl.querySelector("#mtNbList");
  const saveBtn = contentEl.querySelector("#mtNbSaveBtn");

  contentEl.querySelector("#mtNbBack").addEventListener("click", onBack);
  contentEl.querySelector("#mtNbClose").addEventListener("click", onClose);

  const existingGrades = await mtFetchGradesForTask(apiFetch, task.id);
  const scoreByStudent = new Map(existingGrades.map(g => [g.student_id, g.score]));

  listEl.innerHTML = students.map(s => _rowHtml(s, scoreByStudent.get(s.id))).join("");
  listEl.addEventListener("input", () => _validateAll(listEl, saveBtn));
  _validateAll(listEl, saveBtn);

  saveBtn.addEventListener("click", async () => {
    saveBtn.disabled = true;
    const grades = Array.from(listEl.querySelectorAll(".mt-notas-srow")).map(li => ({
      student_id: li.dataset.studentId,
      score: parseScore(li.querySelector(".mt-notas-input").value).normalized,
    }));
    const ok = await mtSaveBulkGrades(apiFetch, task.id, grades);
    if (!ok) { _validateAll(listEl, saveBtn); return; }
    onSaved?.();
  });
}
