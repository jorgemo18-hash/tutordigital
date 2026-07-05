// bulk-grade-drawer.js — Drawer de notas en masa por tarea.
// Patrón idéntico a grade-drawer.js. Singleton.

import { apiFetch, clearSession } from "../../../shared/js/auth.js";
import { formatStudentName, normalizeStudent } from "../state.js";
import { parseScore } from "./scoreValidation.js";
import { escHtml as _esc } from "../../../shared/js/escHtml.js";

// ── Singleton DOM ─────────────────────────────────────────────────────────

let _overlay = null;
let _panel   = null;

// ── Inner element refs ────────────────────────────────────────────────────

let _titleEl, _footerEl, _saveBtn, _bodyList;

// ── Drawer state ──────────────────────────────────────────────────────────

let _ctx        = null;
let _taskId     = null;
let _taskTitle  = "";
let _stacked    = false;
let _onSaved    = null;

// ── Helpers ───────────────────────────────────────────────────────────────

function _typeLabel(type) {
  return type === "work" ? "TRABAJO" : "EXAMEN";
}

function _typeBadgeClass(type) {
  return type === "work" ? "bgd-badge--work" : "bgd-badge--exam";
}

// ── Init (singleton) ──────────────────────────────────────────────────────

function _init() {
  if (_overlay) return;

  _overlay = document.createElement("div");
  _overlay.className = "dd-overlay";
  _overlay.id = "bulkGradeDrawerOverlay";
  _overlay.addEventListener("click", closeBulkGradeDrawer);

  _panel = document.createElement("aside");
  _panel.className = "dd-panel";
  _panel.setAttribute("role", "dialog");
  _panel.setAttribute("aria-modal", "true");
  _panel.setAttribute("aria-labelledby", "bgdTitle");
  _panel.addEventListener("click", e => e.stopPropagation());

  _panel.innerHTML = `
    <div class="dd-head">
      <div class="dd-head-top">
        <h2 class="bgd-title" id="bgdTitle">Notas en masa</h2>
        <button class="dd-close" id="bgdCloseBtn" type="button" title="Cerrar">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"
               stroke-width="2" stroke-linecap="round" aria-hidden="true">
            <path d="M18 6 6 18M6 6l12 12"/>
          </svg>
        </button>
      </div>
    </div>
    <div class="dd-body">
      <ul class="bgd-list" id="bgdList"></ul>
      <div class="bgd-footer" id="bgdFooter">
        <span class="bgd-counter" id="bgdCounter"></span>
        <button class="btn copper-cta" id="bgdSaveBtn" type="button">Guardar todo</button>
      </div>
    </div>
  `;

  _overlay.appendChild(_panel);
  document.body.appendChild(_overlay);

  _titleEl  = _panel.querySelector("#bgdTitle");
  _bodyList = _panel.querySelector("#bgdList");
  _footerEl = _panel.querySelector("#bgdFooter");
  _saveBtn  = _panel.querySelector("#bgdSaveBtn");

  _panel.querySelector("#bgdCloseBtn").addEventListener("click", closeBulkGradeDrawer);
  document.addEventListener("keydown", e => {
    if (e.key === "Escape" && _overlay?.classList.contains("open")) closeBulkGradeDrawer();
  });
  _saveBtn.addEventListener("click", () => _handleSave().catch(console.error));

  // Update counter and per-row validation on any input change
  _bodyList.addEventListener("input", e => {
    _updateCounter();
    const inp = e.target.closest(".bgd-score-input");
    if (inp) _validateRow(inp);
  });
}

// Validates a single score input, toggling its error styling/message in
// place. Returns true when the value is valid (empty counts as valid).
function _validateRow(inp) {
  const parsed = parseScore(inp.value);
  const item = inp.closest(".bgd-item");
  let errEl = item?.querySelector(".bgd-score-error");

  if (parsed.valid) {
    inp.classList.remove("bgd-score-input--error");
    if (errEl) errEl.textContent = "";
    return true;
  }

  inp.classList.add("bgd-score-input--error");
  if (!errEl && item) {
    errEl = document.createElement("span");
    errEl.className = "bgd-score-error";
    item.appendChild(errEl);
  }
  if (errEl) errEl.textContent = parsed.error;
  return false;
}

// ── Render ────────────────────────────────────────────────────────────────

function _getStudents() {
  if (!_ctx) return [];
  const raw = Array.isArray(_ctx.state.data.students) ? _ctx.state.data.students : [];
  return raw
    .filter(s => s.tenantId === _ctx.state.tenantId && s.groupId === _ctx.state.currentGroupId)
    .map(s => normalizeStudent(s))
    .sort((a, b) => {
      const surnameA = (a.surname || a.lastName || "").toLowerCase();
      const surnameB = (b.surname || b.lastName || "").toLowerCase();
      return surnameA.localeCompare(surnameB, "es");
    });
}

function _renderStudentRows(students, existingGrades) {
  const gradeByStudent = new Map(existingGrades.map(g => [g.student_id, g.score]));

  _bodyList.innerHTML = "";
  students.forEach(student => {
    const name = formatStudentName(student);
    const existingScore = gradeByStudent.get(student.id) || "";

    const li = document.createElement("li");
    li.className = "bgd-item";
    li.innerHTML = `
      <span class="bgd-student-name">${_esc(name)}</span>
      <input
        class="bgd-score-input"
        type="text"
        data-student-id="${_esc(student.id)}"
        value="${_esc(existingScore)}"
        placeholder="—"
        autocomplete="off"
      />
    `;
    _bodyList.appendChild(li);
  });
}

function _updateCounter() {
  const inputs = _bodyList.querySelectorAll(".bgd-score-input");
  let empty = 0;
  inputs.forEach(inp => { if (!inp.value.trim()) empty++; });
  const counterEl = _panel.querySelector("#bgdCounter");
  if (counterEl) counterEl.textContent = empty > 0 ? `${empty} alumno${empty === 1 ? "" : "s"} sin nota` : "Todos con nota";
}

// ── Save ──────────────────────────────────────────────────────────────────

async function _handleSave() {
  if (!_taskId) return;

  const inputs = _bodyList.querySelectorAll(".bgd-score-input");
  let allValid = true;
  inputs.forEach(inp => { if (!_validateRow(inp)) allValid = false; });
  if (!allValid) return;

  const grades = [];
  inputs.forEach(inp => {
    grades.push({ student_id: inp.dataset.studentId, score: parseScore(inp.value).normalized });
  });

  _saveBtn.disabled = true;
  try {
    const res = await apiFetch("/api/v1/grades/bulk", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ task_id: _taskId, grades }),
    });

    if (!res.ok) {
      if (res.status === 401) { clearSession(); window.location.href = "/login"; }
      return;
    }

    _onSaved?.();
    closeBulkGradeDrawer();
  } finally {
    _saveBtn.disabled = false;
  }
}

// ── Public API ────────────────────────────────────────────────────────────

export async function openBulkGradeDrawer(ctx, taskId, { onSaved, stacked = false, taskTitle, taskType } = {}) {
  _init();
  _ctx      = ctx;
  _taskId   = taskId;
  _onSaved  = onSaved || null;
  _stacked  = stacked;

  // Task info — prefer passed-in values (task-picker has fresh API data), fall back to state
  if (!taskTitle) {
    const allTasks = [
      ...(Array.isArray(ctx.state.data.tasks) ? ctx.state.data.tasks : []),
      ...(Array.isArray(ctx.state.data.weekTasks) ? ctx.state.data.weekTasks : []),
    ];
    const task = allTasks.find(t => t.id === taskId);
    taskTitle = task?.title || "Tarea";
    taskType  = task?.type  || "exam";
  }
  _taskTitle = taskTitle;
  const type = taskType || "exam";

  // Resolve group name
  const group = (ctx.state.data.groups || []).find(g => g.id === ctx.state.currentGroupId);
  const groupName = group?.name || "";

  _titleEl.innerHTML = `
    <span class="bgd-badge ${_typeBadgeClass(type)}">${_typeLabel(type)}</span>
    ${_esc(_taskTitle)}
    ${groupName ? `<span class="bgd-group">${_esc(groupName)}</span>` : ""}
  `;

  // Stacked mode: no backdrop (Level 1 already has it), higher z-index
  if (stacked) {
    _overlay.classList.add("dd-overlay--stacked");
    _panel.classList.add("dd-panel--stacked");
  } else {
    _overlay.classList.remove("dd-overlay--stacked");
    _panel.classList.remove("dd-panel--stacked");
  }

  // Open drawer
  _overlay.classList.add("open");
  _panel.classList.add("open");
  _bodyList.innerHTML = `<li class="bgd-loading">Cargando...</li>`;

  // Fetch existing grades
  let existingGrades = [];
  try {
    const res = await apiFetch(`/api/v1/grades?task_id=${encodeURIComponent(taskId)}`);
    if (res.ok) {
      const body = await res.json().catch(() => ({}));
      existingGrades = body?.data || [];
    } else if (res.status === 401) {
      clearSession();
      window.location.href = "/login";
      return;
    }
  } catch { /* network error — show empty */ }

  const students = _getStudents();
  _renderStudentRows(students, existingGrades);
  _updateCounter();
}

export function closeBulkGradeDrawer() {
  const wasStacked = _stacked;
  _overlay?.classList.remove("open", "dd-overlay--stacked");
  _panel?.classList.remove("open", "dd-panel--stacked");
  _ctx       = null;
  _taskId    = null;
  _taskTitle = "";
  _onSaved   = null;
  _stacked   = false;
  if (wasStacked) {
    document.dispatchEvent(new CustomEvent("bulkGradeDrawerClosed"));
  }
}
