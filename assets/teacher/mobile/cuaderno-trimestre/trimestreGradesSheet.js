// trimestreGradesSheet.js — "Exámenes/Trabajos → Ver" sub-view: thin
// wrapper that labels the sheet by type and delegates the actual read-only
// list (with Editar/× actions) to the shared grades-sheet component.

import { renderGradesList } from "../grades-sheet/gradesListSheet.js";

const TYPE_LABEL = { exam: "Exámenes", work: "Trabajos" };

export function renderTrimestreGrades({ contentEl, studentName, type, grades, apiFetch, onBack, onClose }) {
  renderGradesList({
    contentEl,
    title: `${TYPE_LABEL[type] || "Notas"} · ${studentName}`,
    grades, apiFetch, onBack, onClose,
  });
}
