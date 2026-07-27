// grade-drawer.js — Drawer lateral de notas (exámenes / trabajos).
// Reemplaza el popup taskGradeModal. Singleton, patrón idéntico a session-drawer.js.

import { apiFetch, clearSession } from "../../../shared/js/auth.js";
import { formatStudentName, normalizeStudent } from "../state.js";
import { formatDate } from "../utils.js";
import { parseScore } from "./scoreValidation.js";
import { pooledTasks, renderGradeList } from "./gradeDrawerList.js";
import { renderTaskCards } from "./gradeDrawerTaskCards.js";
import { showScoreError, clearScoreError } from "./gradeDrawerScoreError.js";
import { buildGradeDrawerDom } from "./gradeDrawerTemplate.js";
import { escHtml as _esc } from "../../../shared/js/escHtml.js";
import { createUnsavedChangesGuard } from "../../../shared/js/unsavedChanges/unsavedChangesGuard.js";
import { snapshotFormValues } from "../../../shared/js/unsavedChanges/snapshotFormValues.js";
import { attachCierreConGuarda } from "../../../shared/js/unsavedChanges/attachCierreConGuarda.js";

// ── Singleton DOM ─────────────────────────────────────────────────────────

let _overlay = null;
let _panel   = null;

// ── Inner element refs ────────────────────────────────────────────────────

let _titleEl, _taskLabelEl, _taskSection, _taskCards, _studentRow, _studentSel,
    _formSect, _scoreInput, _scoreError, _cancelBtn, _saveBtn, _list, _empty;

// ── Drawer state ──────────────────────────────────────────────────────────

let _ctx             = null;
let _activeTaskId    = null;
let _activeStudentId = null;
let _editGradeId     = null;
let _allTasks        = [];
let _skipTaskCards   = false; // when true: hide task-card tabs, load all tasks' grades at once
let _readOnly        = false; // when true: hide the new-grade form unless actively editing a row
let _guard = null, _intentarCerrar = null; // cambios sin guardar — ver unsavedChangesGuard.js

// ── Init (singleton) ──────────────────────────────────────────────────────

function _init() {
  if (_overlay) return;

  const dom = buildGradeDrawerDom();
  _overlay     = dom.overlay;
  _panel       = dom.panel;
  _titleEl     = dom.titleEl;
  _taskLabelEl = dom.taskLabelEl;
  _taskSection = dom.taskSection;
  _taskCards   = dom.taskCards;
  _studentRow  = dom.studentRow;
  _studentSel  = dom.studentSel;
  _formSect    = dom.formSect;
  _scoreInput  = dom.scoreInput;
  _scoreError  = dom.scoreError;
  _cancelBtn   = dom.cancelBtn;
  _saveBtn     = dom.saveBtn;
  _list        = dom.list;
  _empty       = dom.empty;

  _overlay.addEventListener("click", () => _intentarCerrar());
  _panel.addEventListener("click", e => e.stopPropagation());

  // Cambios sin guardar: la nota en el input, comparada contra su valor al
  // abrir/reabrir el formulario (ver marcarLimpio() en _resetForm/_enterEditMode).
  // El cierre por la X sigue siendo directo (acción explícita, no accidental).
  _guard = createUnsavedChangesGuard({ getSnapshot: () => snapshotFormValues(_formSect) });
  _intentarCerrar = attachCierreConGuarda({ guard: _guard, cerrarFn: closeGradeDrawer });

  // Events
  dom.closeBtn.addEventListener("click", closeGradeDrawer);
  document.addEventListener("keydown", e => {
    if (e.key === "Escape" && _overlay?.classList.contains("open")) _intentarCerrar();
  });
  _saveBtn.addEventListener("click", () => _handleSave().catch(console.error));
  _cancelBtn.addEventListener("click", () => { _resetForm(); _guard.marcarLimpio(); });
  _scoreInput.addEventListener("input", () => clearScoreError(_scoreInput, _scoreError));
  _taskCards.addEventListener("click", e => {
    const card = e.target.closest("[data-gd-task-id]");
    if (card) _switchTask(card.dataset.gdTaskId);
  });
  _list.addEventListener("click", e => {
    const editBtn = e.target.closest("[data-gd-edit]");
    if (editBtn) { _enterEditMode(editBtn.dataset.gdEdit, editBtn.dataset.gdScore); return; }
    const delBtn = e.target.closest("[data-gd-delete]");
    if (delBtn) _deleteGrade(delBtn.dataset.gdDelete).catch(console.error);
  });
}

// ── Helpers ───────────────────────────────────────────────────────────────

function _setFormVisible(visible) {
  _formSect.style.display = visible ? "" : "none";
}

// Read-only opens (e.g. "Ver" from the Trimestre card) behave like
// skipTaskCards even when the caller didn't set it: no task chips, every
// grade across _allTasks pooled into one list, no per-task filtering.
function _poolsAllTasks() {
  return _skipTaskCards || _readOnly;
}

// OJO — no marca el guard como "limpio" aquí: casi siempre a _resetForm()
// le sigue un _loadGrades() que puede rellenar _scoreInput con una nota ya
// existente (autofill), y marcar limpio antes de eso haría que ese
// autofill se confundiera con un cambio real. Cada llamador marca limpio
// cuando de verdad ha terminado de fijar el valor de partida (ver
// _loadGrades/_enterEditMode/el listener de "Cancelar" más abajo).
function _resetForm() {
  _scoreInput.value = "";
  _editGradeId = null;
  _cancelBtn.style.display = "none";
  _saveBtn.textContent = "Guardar";
  clearScoreError(_scoreInput, _scoreError);
  // Read-only mode (e.g. the weekly notebook's grade cells): the form to add
  // a new grade stays hidden until the teacher explicitly taps "Editar".
  _setFormVisible(!_readOnly);
}

function _enterEditMode(gradeId, score) {
  _editGradeId = gradeId;
  _scoreInput.value = score || "";
  _cancelBtn.style.display = "";
  _saveBtn.textContent = "Actualizar";
  _setFormVisible(true);
  _scoreInput.focus();
  _guard.marcarLimpio();
}

function _switchTask(taskId) {
  _activeTaskId = taskId;
  _taskCards.querySelectorAll("[data-gd-task-id]").forEach(c => {
    c.classList.toggle("gd-task-card--active", c.dataset.gdTaskId === taskId);
  });
  _resetForm();
  _loadGrades().catch(console.error);
}

function _renderStudentSelector() {
  if (!_ctx) return;
  const studentsRaw = Array.isArray(_ctx.state.data.students) ? _ctx.state.data.students : [];
  const groupStudents = studentsRaw
    .filter(s => s.tenantId === _ctx.state.tenantId && s.groupId === _ctx.state.currentGroupId)
    .map(s => normalizeStudent(s))
    .sort((a, b) => formatStudentName(a).localeCompare(formatStudentName(b), "es"));
  _studentSel.innerHTML = groupStudents
    .map(s => `<option value="${_esc(s.id)}">${_esc(formatStudentName(s))}</option>`)
    .join("");
}

async function _loadGrades() {
  if (!_activeTaskId) return;

  let grades;

  if (_poolsAllTasks() && _ctx && Array.isArray(_ctx.state.data.periodGrades)) {
    // Use already-fetched period grades — no extra round-trip
    const taskIds = new Set(_allTasks.map(t => t.id));
    grades = _ctx.state.data.periodGrades.filter(g => taskIds.has(g.task_id));
  } else {
    const res = await apiFetch(`/api/v1/grades?task_id=${encodeURIComponent(_activeTaskId)}`);
    if (!res.ok) {
      if (res.status === 401) { clearSession(); window.location.href = "/login"; }
      return;
    }
    const body = await res.json().catch(() => ({}));
    grades = body?.data || [];

    // Merge into ctx.state.data.periodGrades
    if (_ctx) {
      const prev = Array.isArray(_ctx.state.data.periodGrades) ? _ctx.state.data.periodGrades : [];
      _ctx.state.data.periodGrades = [...prev.filter(g => g.task_id !== _activeTaskId), ...grades];
    }
  }

  // Auto-fill if fixed student has exactly one grade (or single-task non-skip
  // mode) — skipped in read-only mode, where the form only appears via "Editar".
  if (_activeStudentId && !_readOnly) {
    const studentGrades = grades.filter(g => g.student_id === _activeStudentId);
    const first = studentGrades[0];
    if (first && !_editGradeId && (!_skipTaskCards || studentGrades.length === 1)) {
      _scoreInput.value = first.score;
      _editGradeId = first.id;
      _cancelBtn.style.display = "";
      _saveBtn.textContent = "Actualizar";
    } else if (!first && !_editGradeId) {
      _saveBtn.textContent = "Guardar";
      _cancelBtn.style.display = "none";
    }
    // Ocultar el task-label cuando ya hay nota (la info aparece en la lista de abajo)
    if (_editGradeId) _taskLabelEl.style.display = "none";
  }

  renderGradeList({ listEl: _list, emptyEl: _empty, grades, activeStudentId: _activeStudentId, ctx: _ctx });
  // Aquí, no en _resetForm(), porque el autofill de arriba (_scoreInput
  // ya con una nota existente) también debe contar como estado "limpio".
  _guard.marcarLimpio();
}

async function _handleSave() {
  const parsed = parseScore(_scoreInput.value);
  if (!parsed.valid) { showScoreError(_scoreInput, _scoreError, parsed.error); return; }
  clearScoreError(_scoreInput, _scoreError);
  if (parsed.empty) { _scoreInput.focus(); return; }
  const score = parsed.normalized;

  const studentId = _activeStudentId || _studentSel?.value;
  if (!studentId || !_activeTaskId) return;

  _saveBtn.disabled = true;
  try {
    let res;
    if (_editGradeId) {
      // PATCH — actualizar nota existente
      res = await apiFetch(`/api/v1/grades/${encodeURIComponent(_editGradeId)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ score }),
      });
    } else {
      // POST — crear nota nueva
      const task  = pooledTasks(_ctx).find(t => t.id === _activeTaskId);
      const title = task?.title || "Nota";
      const date  = formatDate(new Date());
      res = await apiFetch("/api/v1/grades", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ task_id: _activeTaskId, student_id: studentId, title, score, date }),
      });
    }

    if (!res.ok) {
      if (res.status === 401) { clearSession(); window.location.href = "/login"; return; }
      return;
    }

    // In pooled mode, update periodGrades locally so _loadGrades reads fresh data
    if (_poolsAllTasks() && _ctx) {
      const respBody = await res.json().catch(() => ({}));
      const saved = respBody?.data;
      if (saved) {
        const prev = Array.isArray(_ctx.state.data.periodGrades) ? _ctx.state.data.periodGrades : [];
        _ctx.state.data.periodGrades = _editGradeId
          ? prev.map(g => g.id === saved.id ? saved : g)
          : [...prev, saved];
      }
    }

    _resetForm();
    await _loadGrades();
    _ctx?.refreshNotebookForActiveGroup?.();
  } finally {
    _saveBtn.disabled = false;
  }
}

async function _deleteGrade(gradeId) {
  const res = await apiFetch(`/api/v1/grades/${encodeURIComponent(gradeId)}`, { method: "DELETE" });
  if (!res.ok) {
    if (res.status === 401) { clearSession(); window.location.href = "/login"; }
    return;
  }
  // Remove from local periodGrades so _loadGrades reads fresh data immediately
  if (_poolsAllTasks() && _ctx) {
    _ctx.state.data.periodGrades = (_ctx.state.data.periodGrades || []).filter(g => g.id !== gradeId);
  }
  _resetForm();
  await _loadGrades();
  _ctx?.refreshNotebookForActiveGroup?.();
}

// ── Public API ────────────────────────────────────────────────────────────

export async function openGradeDrawer(ctx, taskId, studentId, allTaskIds, { skipTaskCards = false, readOnly = false } = {}) {
  _init();
  _ctx             = ctx;
  _activeTaskId    = taskId;
  _activeStudentId = studentId || null;
  _editGradeId     = null;
  _skipTaskCards   = skipTaskCards;
  _readOnly        = readOnly;

  // Build list of tasks to show as selectable cards
  const pooled = pooledTasks(ctx);
  if (Array.isArray(allTaskIds) && allTaskIds.length >= 1) {
    _allTasks = allTaskIds.map(id => pooled.find(t => t.id === id)).filter(Boolean);
  } else {
    const task = pooled.find(t => t.id === taskId);
    _allTasks = task ? [task] : [];
  }

  // Title
  const task      = pooled.find(t => t.id === taskId);
  const typeLabel = task?.type === "work" ? "Trabajo" : "Examen";
  const singleTask = _allTasks.length === 1;
  const taskTitle  = singleTask ? (_allTasks[0]?.title || "") : "";
  if (studentId) {
    const s    = normalizeStudent((ctx.state.data.students || []).find(st => st.id === studentId));
    const name = formatStudentName(s) || "";
    _titleEl.textContent = name ? `Notas · ${name}` : "Notas";
  } else {
    _titleEl.textContent = `Notas · ${typeLabel}`;
  }
  if (singleTask && taskTitle) {
    _taskLabelEl.querySelector("#gdTaskLabelType").textContent = typeLabel.toUpperCase();
    _taskLabelEl.querySelector("#gdTaskLabelName").textContent = taskTitle;
    _taskLabelEl.style.display = "";
  } else {
    _taskLabelEl.style.display = "none";
  }

  // Task cards
  renderTaskCards({ taskSection: _taskSection, taskCards: _taskCards, allTasks: _allTasks, activeTaskId: _activeTaskId, skipTaskCards: _poolsAllTasks() });

  // Student selector (only when no fixed student)
  if (!studentId) {
    _renderStudentSelector();
    _studentRow.style.display = "";
  } else {
    _studentRow.style.display = "none";
  }

  // Reset form and open
  _resetForm();
  _overlay.classList.add("open");
  _panel.classList.add("open");

  // Fetch grades (may auto-fill for fixed student with existing grade)
  await _loadGrades();
  if (!_readOnly) _scoreInput.focus();
}

export function closeGradeDrawer() {
  _overlay?.classList.remove("open");
  _panel?.classList.remove("open");
  _ctx             = null;
  _activeTaskId    = null;
  _activeStudentId = null;
  _editGradeId     = null;
  _allTasks        = [];
  _skipTaskCards   = false;
  _readOnly        = false;
}
