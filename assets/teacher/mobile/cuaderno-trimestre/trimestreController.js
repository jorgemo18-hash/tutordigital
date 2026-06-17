// trimestreController.js — Orchestrates the mobile Trimestre view: fetches
// the same data desktop uses, computes per-student stats, and wires the
// three navigation levels (list → detail sheet → task list / report sheet).

import { mtFetchStudents, mtFetchSessionsRange, mtFetchTasks } from "../mobileTeacherData.js";
import { openSheet, closeSheet, openSessionSheet } from "../mobileTeacherSheets.js";
import { ensureSubjectsForGroup } from "../subjects/subjectSelect.js";
import {
  mtFetchTermDates, mtFetchNotebookSummary, mtFetchGradesRange, mtFetchGradeWeights,
} from "./trimestreData.js";
import { buildPeriodTasks, buildTaskMaps, tagGradesByType, buildStudentTrimestreData, defaultTrimester } from "./trimestreCalc.js";
import { renderTrimestreList } from "./trimestreList.js";
import { renderTrimestreDetail } from "./trimestreDetailSheet.js";
import { renderTrimestreTaskList } from "./trimestreTaskListSheet.js";
import { openTrimestreReportSheet } from "./trimestreReportSheet.js";

async function _ensureTermDates(mtState, apiFetch) {
  if (!mtState._termDates) {
    mtState._termDates = await mtFetchTermDates(apiFetch);
  }
  return mtState._termDates;
}

function _openDetail({ sheetEl, backdropEl, sheetEl2, backdropEl2, apiFetch, student, data, groupId, trimester, subjectName, from, to }) {
  const contentEl = sheetEl.querySelector("#mtSheetContent");

  function showDetail() {
    renderTrimestreDetail({
      contentEl, studentName: student.name, data,
      onClose: () => closeSheet(sheetEl, backdropEl),
      onOpenTaskList: showTaskList,
      onOpenReport: () => {
        openTrimestreReportSheet({
          sheetEl: sheetEl2, backdropEl: backdropEl2,
          contentEl: sheetEl2.querySelector("#mtSheetContent2"),
          openSheet, closeSheet, apiFetch,
          studentName: student.name, studentId: student.id, groupId, trimester, subjectName, from, to,
          data,
        });
      },
    });
  }

  function showTaskList() {
    renderTrimestreTaskList({
      contentEl, studentName: student.name, progressTasks: data.progressTasks,
      onBack: showDetail,
      onClose: () => closeSheet(sheetEl, backdropEl),
      onViewSession: pt => openSessionSheet({
        sheetEl, backdropEl, apiFetch,
        sessionId: pt.sessionId, studentName: student.name,
      }),
    });
  }

  showDetail();
  openSheet(sheetEl, backdropEl);
}

export async function renderTrimestre({ cardsEl, sheetEl, backdropEl, sheetEl2, backdropEl2, mtState, apiFetch }) {
  const groupId = mtState.currentGroupId;
  cardsEl.innerHTML = `<div class="mt-loading">Cargando…</div>`;

  const termDates = await _ensureTermDates(mtState, apiFetch);
  if (!mtState.trimester) mtState.trimester = defaultTrimester();
  const trimester = mtState.trimester;
  const range = termDates.find(t => t.trimester === trimester);
  if (!range) { cardsEl.innerHTML = `<div class="mt-loading">No se pudo determinar el rango del trimestre.</div>`; return; }
  const { start_date: from, end_date: to } = range;

  const subjectName = mtState.currentSubjectName || "";

  const [students, summary, sessions, grades, allTasks, _subjects, gradeWeights] = await Promise.all([
    mtFetchStudents(apiFetch, groupId),
    mtFetchNotebookSummary(apiFetch, groupId, from, to),
    mtFetchSessionsRange(apiFetch, groupId, from, to),
    mtFetchGradesRange(apiFetch, groupId, from, to),
    mtFetchTasks(apiFetch, groupId, 200),
    ensureSubjectsForGroup(mtState, apiFetch, groupId),
    mtFetchGradeWeights(apiFetch, groupId, trimester),
  ]);

  if (!students.length) { cardsEl.innerHTML = `<div class="mt-loading">No hay alumnos en este grupo.</div>`; return; }

  const summaryByStudent = new Map((summary.students || []).map(s => [s.student_id, s]));
  const periodTasks = buildPeriodTasks(allTasks, from, to);
  const { taskTypeMap, taskTitleMap } = buildTaskMaps(periodTasks);
  const taggedGrades = tagGradesByType(grades, taskTypeMap, taskTitleMap);
  const weights = gradeWeights[0] || null;

  const dataByStudent = new Map();
  students.forEach(student => {
    const data = buildStudentTrimestreData({
      student, summary: summaryByStudent.get(student.id),
      periodTasks, taskTitleMap, sessions, grades: taggedGrades, weights,
    });
    dataByStudent.set(student.id, data);
  });

  renderTrimestreList({
    containerEl: cardsEl, students, dataByStudent,
    onSelectStudent: studentId => {
      const student = students.find(s => s.id === studentId);
      const data = dataByStudent.get(studentId);
      if (!student || !data) return;
      _openDetail({ sheetEl, backdropEl, sheetEl2, backdropEl2, apiFetch, student, data, groupId, trimester, subjectName, from, to });
    },
  });
}
