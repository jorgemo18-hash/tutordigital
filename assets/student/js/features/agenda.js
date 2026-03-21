import { apiFetch } from "../../../shared/js/auth.js";
import { initStudentAgendaTeacherTasks } from "../../features/agenda/studentAgendaTeacherTasks.js";

export async function initStudentAgendaFeature({ getTenant, ACTIVE_USER, btnDeberes, btnExamen, btnTrabajo }) {
  const { injectApiTasks } = initStudentAgendaTeacherTasks({ getTenant, ACTIVE_USER, btnDeberes, btnExamen, btnTrabajo });

  try {
    const res = await apiFetch("/api/v1/tasks");
    if (res.ok) {
      const body = await res.json().catch(() => ({}));
      const tasks = body?.data?.items || [];
      injectApiTasks(tasks);
    }
  } catch {
    // fallback: el localStorage del profesor (renderTeacherTasksIntoAgenda) ya se pintó en el init
  }
}
