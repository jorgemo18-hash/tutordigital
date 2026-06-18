// mobileWeightsSheet.js — "Configurar pesos" sub-view of the "Más" sheet.
// Same fields, validation (sum to 100%) and endpoint as desktop's
// notebook-weight-popover.js, adapted to a full-width mobile sheet instead
// of an anchored popover.

import { mtFetchSubjects } from "../mobileTeacherData.js";
import { mtFetchGradeWeights } from "../cuaderno-trimestre/trimestreData.js";
import { defaultTrimester } from "../cuaderno-trimestre/trimestreCalc.js";
import { mtSaveGradeWeights } from "./weightsData.js";

const SVG_BACK  = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" aria-hidden="true"><polyline points="15 18 9 12 15 6"/></svg>`;
const SVG_CLOSE = `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" aria-hidden="true"><path d="M18 6 6 18M6 6l12 12"/></svg>`;

function _esc(s) { return String(s || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;"); }

function _shellHtml() {
  return `
    <div class="mt-sheet-header">
      <button class="mt-sheet-close" id="mwBack" aria-label="Volver">${SVG_BACK}</button>
      <span class="mt-sheet-title">Configurar pesos</span>
      <button class="mt-sheet-close" id="mwClose" aria-label="Cerrar">${SVG_CLOSE}</button>
    </div>
    <div class="mt-sheet-body" id="mwBody"><div class="mt-loading">Cargando…</div></div>
    <div class="mt-sheet-footer">
      <button class="mt-btn mt-btn--primary" type="button" id="mwSaveBtn" style="width:100%">Guardar</button>
    </div>`;
}

function _formHtml(subjects, weights) {
  const subjectOptions = subjects.length > 1
    ? `<div class="mt-form-field">
         <label class="mt-form-label">Asignatura</label>
         <select class="mt-form-select" id="mwSubjectSel">
           ${subjects.map(s => `<option value="${_esc(s.id)}">${_esc(s.name)}</option>`).join("")}
         </select>
       </div>`
    : "";
  const w = weights[0] || { exam_pct: 60, work_pct: 20, homework_pct: 20 };
  return `
    ${subjectOptions}
    <div class="mt-form-field">
      <label class="mt-form-label">Exámenes</label>
      <input class="mt-form-input" id="mwExam" type="number" min="0" max="100" step="1" value="${w.exam_pct}">
    </div>
    <div class="mt-form-field">
      <label class="mt-form-label">Trabajos</label>
      <input class="mt-form-input" id="mwWork" type="number" min="0" max="100" step="1" value="${w.work_pct}">
    </div>
    <div class="mt-form-field">
      <label class="mt-form-label">Tareas / deberes</label>
      <input class="mt-form-input" id="mwHw" type="number" min="0" max="100" step="1" value="${w.homework_pct}">
    </div>
    <p class="mt-weights-total" id="mwTotal">Total: 100%</p>
    <p class="mt-loading-line mt-loading-line--err" id="mwErr" style="display:none"></p>`;
}

export async function renderMobileWeightsSheet({ contentEl, apiFetch, groupId, onBack, onClose }) {
  contentEl.innerHTML = _shellHtml();
  contentEl.querySelector("#mwBack").addEventListener("click", onBack);
  contentEl.querySelector("#mwClose").addEventListener("click", onClose);

  const bodyEl = contentEl.querySelector("#mwBody");
  const saveBtn = contentEl.querySelector("#mwSaveBtn");

  if (!groupId) {
    bodyEl.innerHTML = `<div class="mt-loading">Selecciona un grupo en el Cuaderno primero.</div>`;
    saveBtn.disabled = true;
    return;
  }

  const trimester = defaultTrimester();
  const [subjects, weights] = await Promise.all([
    mtFetchSubjects(apiFetch, groupId),
    mtFetchGradeWeights(apiFetch, groupId, trimester),
  ]);

  if (!subjects.length) {
    bodyEl.innerHTML = `<div class="mt-loading">No hay asignaturas configuradas para este grupo.</div>`;
    saveBtn.disabled = true;
    return;
  }

  bodyEl.innerHTML = _formHtml(subjects, weights);

  const subjectSel = bodyEl.querySelector("#mwSubjectSel");
  const examEl = bodyEl.querySelector("#mwExam");
  const workEl = bodyEl.querySelector("#mwWork");
  const hwEl   = bodyEl.querySelector("#mwHw");
  const totalEl = bodyEl.querySelector("#mwTotal");
  const errEl   = bodyEl.querySelector("#mwErr");

  function fillInputs(subjectId) {
    const w = weights.find(item => item.subject_id === subjectId) || { exam_pct: 60, work_pct: 20, homework_pct: 20 };
    examEl.value = w.exam_pct;
    workEl.value = w.work_pct;
    hwEl.value   = w.homework_pct;
    updateTotal();
  }

  function updateTotal() {
    const sum = [examEl, workEl, hwEl].reduce((a, inp) => a + (parseFloat(inp.value) || 0), 0);
    totalEl.textContent = `Total: ${Math.round(sum * 100) / 100}%`;
    totalEl.classList.toggle("mt-weights-total--err", Math.round(sum) !== 100);
  }

  subjectSel?.addEventListener("change", () => fillInputs(subjectSel.value));
  [examEl, workEl, hwEl].forEach(inp => inp.addEventListener("input", updateTotal));
  updateTotal();

  saveBtn.addEventListener("click", async () => {
    const subjectId = subjectSel ? subjectSel.value : subjects[0].id;
    const examPct = parseFloat(examEl.value) || 0;
    const workPct = parseFloat(workEl.value) || 0;
    const homeworkPct = parseFloat(hwEl.value) || 0;
    if (Math.round((examPct + workPct + homeworkPct) * 100) !== 10000) {
      errEl.textContent = "Los porcentajes deben sumar exactamente 100.";
      errEl.style.display = "block";
      return;
    }
    errEl.style.display = "none";
    saveBtn.disabled = true;
    saveBtn.textContent = "Guardando…";
    const ok = await mtSaveGradeWeights(apiFetch, { subjectId, trimester, examPct, workPct, homeworkPct });
    saveBtn.disabled = false;
    saveBtn.textContent = "Guardar";
    if (!ok) {
      errEl.textContent = "Error al guardar. Inténtalo de nuevo.";
      errEl.style.display = "block";
      return;
    }
    onBack();
  });
}
