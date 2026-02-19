import { renderAgendaFromMock } from "../../features/agenda/agendaUI.js";
import { initStudentAgendaTeacherTasks } from "../../features/agenda/studentAgendaTeacherTasks.js";

export function initStudentAgendaFeature({ getTenant, ACTIVE_USER, btnDeberes, btnExamen, btnTrabajo }) {
  renderAgendaFromMock({ btnDeberes, btnExamen, btnTrabajo });
  initStudentAgendaTeacherTasks({ getTenant, ACTIVE_USER, btnDeberes, btnExamen, btnTrabajo });
}
