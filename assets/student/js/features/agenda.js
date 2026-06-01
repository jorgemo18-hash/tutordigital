import { apiFetch } from "../../../shared/js/auth.js";
import { initStudentAgendaTeacherTasks } from "../../features/agenda/studentAgendaTeacherTasks.js";

export async function initStudentAgendaFeature({ getTenant, ACTIVE_USER, btnDeberes, btnExamen, btnTrabajo, selectTask, onRefreshTaskContext }) {
  const btnAtrasadas = document.getElementById("btnAtrasadas");
  const { injectApiTasks, refreshTaskContext } = initStudentAgendaTeacherTasks({ getTenant, ACTIVE_USER, btnDeberes, btnExamen, btnTrabajo, btnAtrasadas, selectTask });

  // Exponer refreshTaskContext al caller (student.js) para usarlo en la restauración de sesión
  if (typeof onRefreshTaskContext === "function") {
    onRefreshTaskContext(refreshTaskContext);
  }

  try {
    const res = await apiFetch("/api/v1/tasks");
    const body = await res.json().catch(() => ({}));
    injectApiTasks(res.ok ? (body?.data?.items || []) : []);
  } catch {
    injectApiTasks([]);
  }
}
