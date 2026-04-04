import { apiFetch } from "../../../shared/js/auth.js";
import { initStudentAgendaTeacherTasks } from "../../features/agenda/studentAgendaTeacherTasks.js";

export async function initStudentAgendaFeature({ getTenant, ACTIVE_USER, btnDeberes, btnExamen, btnTrabajo, selectTask }) {
  const { injectApiTasks } = initStudentAgendaTeacherTasks({ getTenant, ACTIVE_USER, btnDeberes, btnExamen, btnTrabajo, selectTask });

  try {
    const res = await apiFetch("/api/v1/tasks");
    const body = await res.json().catch(() => ({}));
    injectApiTasks(res.ok ? (body?.data?.items || []) : []);
  } catch {
    injectApiTasks([]);
  }
}
