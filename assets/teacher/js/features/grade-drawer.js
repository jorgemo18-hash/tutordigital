// grade-drawer.js — Drawer lateral de notas (exámenes / trabajos).
// Reemplaza el popup taskGradeModal. Singleton, patrón idéntico a session-drawer.js.

import { apiFetch, clearSession } from "../../../shared/js/auth.js";
import { formatStudentName, normalizeStudent } from "../state.js";
import { formatDate } from "../utils.js";

// ── Singleton DOM ─────────────────────────────────────────────────────────

let _overlay = null;
let _panel   = null;

// ── Inner element refs ────────────────────────────────────────────────────

let _titleEl, _taskLabelEl, _taskSection, _taskCards, _studentRow, _studentSel,
    _scoreInput, _cancelBtn, _saveBtn, _list, _empty;

// ── Drawer state ──────────────────────────────────────────────────────────

let _ctx             = null;
let _activeTaskId    = null;
let _activeStudentId = null;
let _editGradeId     = null;
let _allTasks        = [];
let _skipTaskCards   = false; // when true: hide task-card tabs, load all tasks' grades at once

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

      <div class="gd-form-sect">
        <div class="gd-form-row">
          <input class="gd-score-input" id="gdScoreInput" type="text"
                 placeholder="Ej. 8,5 · B+ · Apto" autocomplete="off" />
          <button class="btn ghost" id="gdCancelBtn" type="button" style="display:none">Cancelar</button>
          <button class="btn copper-cta" id="gdSaveBtn" type="button">Guardar</button>
        </div>
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
  _scoreInput  = _panel.querySelector("#gdScoreInput");
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

function _pooledTasks() {
  if (!_ctx) return [];
  return [
    ...(Array.isArray(_ctx.state.data.weekTasks) ? _ctx.state.data.weekTasks : []),
    ...(Array.isArray(_ctx.state.data.tasks) ? _ctx.state.data.tasks : []),
  ];
}

function _resetForm() {
  _scoreInput.value = "";
  _editGradeId = null;
  _cancelBtn.style.display = "none";
  _saveBtn.textContent = "Guardar";
}

function _enterEditMode(gradeId, score) {
  _editGradeId = gradeId;
  _scoreInput.value = score || "";
  _cancelBtn.style.display = "";
  _saveBtn.textContent = "Actualizar";
  _scoreInput.focus();
}

function _renderTaskCards() {
  // In skipTaskCards mode (e.g. period "Ver" button) or when ≤1 task: hide section
  if (_skipTaskCards || _allTasks.length <= 1) {
    _taskSection.style.display = "none";
    return;
  }
  _taskSection.style.display = "";
  _taskCards.innerHTML = "";
  _allTasks.forEach(task => {
    const btn = document.createElement("button");
    btn.className = "gd-task-card" + (task.id === _activeTaskId ? " gd-task-card--active" : "");
    btn.type = "button";
    btn.dataset.gdTaskId = task.id;
    btn.innerHTML = `
      <span class="gd-task-name">${_esc(task.title)}</span>
      <span class="gd-task-date">${_esc(task.dueDate || "")}</span>
    `;
    _taskCards.appendChild(btn);
  });
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

  // Auto-fill if fixed student has exactly one grade (or single-task non-skip mode)
  if (_activeStudentId) {
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

  _renderGradeList(grades);
}

function _renderGradeList(grades) {
  const allTasks       = _pooledTasks();
  const taskTitleMap   = new Map(allTasks.map(t => [t.id, t.title]));
  const taskSubjectMap = new Map(allTasks.map(t => [t.id, t.subjectName || ""]));

  const studentsRaw = Array.isArray(_ctx?.state?.data?.students) ? _ctx.state.data.students : [];
  const studentsMap = new Map(studentsRaw.map(s => [s.id, normalizeStudent(s)]));

  const filtered = _activeStudentId
    ? grades.filter(g => g.student_id === _activeStudentId)
    : grades;

  _list.innerHTML = "";
  filtered.forEach(grade => {
    const taskTitle   = taskTitleMap.get(grade.task_id) || grade.title || "—";
    const subject     = taskSubjectMap.get(grade.task_id) || "";
    const studentName = !_activeStudentId
      ? (formatStudentName(studentsMap.get(grade.student_id)) || "Alumno")
      : null;

    const li = document.createElement("li");
    li.className = "gd-grade-item";
    li.innerHTML = `
      <div class="gd-grade-score">${_esc(grade.score)}</div>
      <div class="gd-grade-info">
        ${subject ? `<div class="gd-grade-subject">${_esc(subject)}</div>` : ""}
        <div class="gd-grade-task">${_esc(taskTitle)}</div>
        <div class="gd-grade-date">${studentName ? `${_esc(studentName)} · ` : ""}${_esc(grade.date || "")}</div>
      </div>
      <div class="gd-grade-actions">
        <button class="btn ghost" style="font-size:11px;padding:4px 8px"
          data-gd-edit="${_esc(grade.id)}"
          data-gd-score="${_esc(grade.score)}"
          type="button">Editar</button>
        <button class="btn ghost" style="font-size:11px;padding:4px 8px"
          data-gd-delete="${_esc(grade.id)}"
          type="button">✕</button>
      </div>
    `;
    _list.appendChild(li);
  });

  _empty.style.display = filtered.length ? "none" : "block";
}

async function _handleSave() {
  const score = _scoreInput.value.trim().replace(",", ".");
  if (!score) { _scoreInput.focus(); return; }

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
      const task  = _pooledTasks().find(t => t.id === _activeTaskId);
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

export async function openGradeDrawer(ctx, taskId, studentId, allTaskIds, { skipTaskCards = false } = {}) {
  _init();
  _ctx             = ctx;
  _activeTaskId    = taskId;
  _activeStudentId = studentId || null;
  _editGradeId     = null;
  _skipTaskCards   = skipTaskCards;

  // Build list of tasks to show as selectable cards
  const pooled = [
    ...(Array.isArray(ctx.state.data.weekTasks) ? ctx.state.data.weekTasks : []),
    ...(Array.isArray(ctx.state.data.tasks) ? ctx.state.data.tasks : []),
  ];
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
  _renderTaskCards();

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
  _scoreInput.focus();
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
}
