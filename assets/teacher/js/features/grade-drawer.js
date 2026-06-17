// grade-drawer.js — Drawer lateral de notas (exámenes / trabajos).
// Reemplaza el popup taskGradeModal. Singleton, patrón idéntico a session-drawer.js.

import { apiFetch, clearSession } from "../../../shared/js/auth.js";
import { formatStudentName, normalizeStudent } from "../state.js";
import { formatDate } from "../utils.js";
import { parseScore } from "./scoreValidation.js";
import { pooledTasks, renderGradeList } from "./gradeDrawerList.js";
import { renderTaskCards } from "./gradeDrawerTaskCards.js";

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

// ── Escape helper ─────────────────────────────────────────────────────────

function _esc(s) {
  return String(s ?? "")
    .replace(/&/g, "&amp;").replace(/</g, "&lt;")
    .replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

// ── Init (singleton) ──────────────────────────────────────────────────────

function _init() {
  if (_overlay) return;

  _overlay = document.createElement("div");
  _overlay.className = "dd-overlay";
  _overlay.id = "gradeDrawerOverlay";
  _overlay.addEventListener("click", closeGradeDrawer);

  _panel = document.createElement("aside");
  _panel.className = "dd-panel";
  _panel.setAttribute("role", "dialog");
  _panel.setAttribute("aria-modal", "true");
  _panel.setAttribute("aria-labelledby", "gdTitle");
  _panel.addEventListener("click", e => e.stopPropagation());

  _panel.innerHTML = `
    <div class="dd-head">
      <div class="dd-head-top">
        <h2 class="gd-title" id="gdTitle">Notas</h2>
        <button class="dd-close" id="gdCloseBtn" type="button" title="Cerrar">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"
               stroke-width="2" stroke-linecap="round" aria-hidden="true">
            <path d="M18 6 6 18M6 6l12 12"/>
          </svg>
        </button>
      </div>
    </div>
    <div class="dd-body">

      <div class="gd-task-section" id="gdTaskSection" style="display:none">
        <div class="gd-sect-label">Tarea</div>
        <div class="gd-task-cards" id="gdTaskCards"></div>
      </div>

      <div class="gd-student-row" id="gdStudentRow" style="display:none">
        <label class="gd-label" for="gdStudentSel">Alumno</label>
        <select class="gd-select" id="gdStudentSel"></select>
      </div>

      <div class="gd-task-label" id="gdTaskLabel" style="display:none">
        <span class="gd-task-label-type" id="gdTaskLabelType"></span>
        <span class="gd-task-label-name" id="gdTaskLabelName"></span>
      </div>

      <div class="gd-form-sect" id="gdFormSect">
        <div class="gd-form-row">
          <input class="gd-score-input" id="gdScoreInput" type="text"
                 placeholder="Ej. 8,5" autocomplete="off" />
          <button class="btn ghost" id="gdCancelBtn" type="button" style="display:none">Cancelar</button>
          <button class="btn copper-cta" id="gdSaveBtn" type="button">Guardar</button>
        </div>
        <p class="gd-score-error" id="gdScoreError" style="display:none"></p>
      </div>

      <div class="gd-list-sect">
        <div class="gd-sect-label">Notas registradas</div>
        <ul class="gd-list" id="gdList"></ul>
        <p class="gd-empty" id="gdEmpty">Sin notas aún.</p>
      </div>

    </div>
  `;

  _overlay.appendChild(_panel);
  document.body.appendChild(_overlay);

  // Cache inner refs
  _titleEl     = _panel.querySelector("#gdTitle");
  _taskLabelEl = _panel.querySelector("#gdTaskLabel");
  _taskSection = _panel.querySelector("#gdTaskSection");
  _taskCards   = _panel.querySelector("#gdTaskCards");
  _studentRow  = _panel.querySelector("#gdStudentRow");
  _studentSel  = _panel.querySelector("#gdStudentSel");
  _formSect    = _panel.querySelector("#gdFormSect");
  _scoreInput  = _panel.querySelector("#gdScoreInput");
  _scoreError  = _panel.querySelector("#gdScoreError");
  _cancelBtn   = _panel.querySelector("#gdCancelBtn");
  _saveBtn     = _panel.querySelector("#gdSaveBtn");
  _list        = _panel.querySelector("#gdList");
  _empty       = _panel.querySelector("#gdEmpty");

  // Events
  _panel.querySelector("#gdCloseBtn").addEventListener("click", closeGradeDrawer);
  document.addEventListener("keydown", e => {
    if (e.key === "Escape" && _overlay?.classList.contains("open")) closeGradeDrawer();
  });
  _saveBtn.addEventListener("click", () => _handleSave().catch(console.error));
  _cancelBtn.addEventListener("click", _resetForm);
  _scoreInput.addEventListener("input", _clearScoreError);
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

function _showScoreError(message) {
  _scoreInput.classList.add("gd-score-input--error");
  _scoreError.textContent = message;
  _scoreError.style.display = "";
}

function _clearScoreError() {
  _scoreInput.classList.remove("gd-score-input--error");
  _scoreError.textContent = "";
  _scoreError.style.display = "none";
}

function _setFormVisible(visible) {
  _formSect.style.display = visible ? "" : "none";
}

function _resetForm() {
  _scoreInput.value = "";
  _editGradeId = null;
  _cancelBtn.style.display = "none";
  _saveBtn.textContent = "Guardar";
  _clearScoreError();
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

  if (_skipTaskCards && _ctx && Array.isArray(_ctx.state.data.periodGrades)) {
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
}

async function _handleSave() {
  const parsed = parseScore(_scoreInput.value);
  if (!parsed.valid) { _showScoreError(parsed.error); return; }
  _clearScoreError();
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

    // In skipTaskCards mode, update periodGrades locally so _loadGrades reads fresh data
    if (_skipTaskCards && _ctx) {
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
  if (_skipTaskCards && _ctx) {
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
  renderTaskCards({ taskSection: _taskSection, taskCards: _taskCards, allTasks: _allTasks, activeTaskId: _activeTaskId, skipTaskCards: _skipTaskCards });

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
