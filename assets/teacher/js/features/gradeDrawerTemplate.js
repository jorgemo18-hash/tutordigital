// gradeDrawerTemplate.js — construcción del DOM de grade-drawer.js
// (overlay + panel + su innerHTML), separada de _init() para que este
// último quede solo con el cableado de listeners/guard — extraído
// también para dejarle a grade-drawer.js margen real por debajo de las
// 400 líneas, no solo para cumplir el número.
export function buildGradeDrawerDom() {
  const overlay = document.createElement("div");
  overlay.className = "dd-overlay";
  overlay.id = "gradeDrawerOverlay";

  const panel = document.createElement("aside");
  panel.className = "dd-panel";
  panel.setAttribute("role", "dialog");
  panel.setAttribute("aria-modal", "true");
  panel.setAttribute("aria-labelledby", "gdTitle");

  panel.innerHTML = `
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

  overlay.appendChild(panel);
  document.body.appendChild(overlay);

  return {
    overlay,
    panel,
    titleEl: panel.querySelector("#gdTitle"),
    closeBtn: panel.querySelector("#gdCloseBtn"),
    taskLabelEl: panel.querySelector("#gdTaskLabel"),
    taskSection: panel.querySelector("#gdTaskSection"),
    taskCards: panel.querySelector("#gdTaskCards"),
    studentRow: panel.querySelector("#gdStudentRow"),
    studentSel: panel.querySelector("#gdStudentSel"),
    formSect: panel.querySelector("#gdFormSect"),
    scoreInput: panel.querySelector("#gdScoreInput"),
    scoreError: panel.querySelector("#gdScoreError"),
    cancelBtn: panel.querySelector("#gdCancelBtn"),
    saveBtn: panel.querySelector("#gdSaveBtn"),
    list: panel.querySelector("#gdList"),
    empty: panel.querySelector("#gdEmpty"),
  };
}
