// notasController.js — Orchestrates "Poner notas": list of gradable tasks
// (Level 1, inline in the Cuaderno page) → per-student bulk sheet
// (Level 2, in the shared mtSheet bottom sheet).

import { mtFetchStudents } from "../mobileTeacherData.js";
import { openSheet, closeSheet } from "../mobileTeacherSheets.js";
import { mtFetchGradableTasks } from "./notasData.js";
import { renderNotasTaskList } from "./notasTaskList.js";
import { renderNotasBulkSheet } from "./notasBulkSheet.js";

export async function renderNotas({ containerEl, sheetEl, backdropEl, mtState, apiFetch }) {
  const groupId = mtState.currentGroupId;
  containerEl.innerHTML = `<div class="mt-loading">Cargando…</div>`;

  const [allTasks, students] = await Promise.all([
    mtFetchGradableTasks(apiFetch, groupId),
    mtFetchStudents(apiFetch, groupId),
  ]);

  const tasks = mtState.currentSubjectName
    ? allTasks.filter(t => (t.subject_name || "") === mtState.currentSubjectName)
    : allTasks;

  function showTaskList() {
    renderNotasTaskList({
      containerEl, tasks, totalStudents: students.length, apiFetch,
      onSelectTask: showBulkSheet,
    });
  }

  function showBulkSheet(task) {
    const contentEl = sheetEl.querySelector("#mtSheetContent");
    renderNotasBulkSheet({
      contentEl, task, students, apiFetch,
      onBack:  () => closeSheet(sheetEl, backdropEl),
      onClose: () => closeSheet(sheetEl, backdropEl),
      onSaved: () => { closeSheet(sheetEl, backdropEl); showTaskList(); },
    });
    openSheet(sheetEl, backdropEl);
  }

  showTaskList();
}
