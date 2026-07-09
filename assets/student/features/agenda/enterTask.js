// Entra al tutor con una tarea concreta — extraído literal del cuerpo de
// handleCardClick (studentAgendaTeacherTasks.js) para que sea el único
// camino que activa el tutor, tanto al clicar una tarjeta de agenda como
// al arrancar una sesión libre (sesionLibre.js). Antes, sesión libre
// reproducía estos pasos a mano por su cuenta, y cada paso no reproducido
// era un bug nuevo (listener del botón, disparo del picker, drop).
import { populateContextPane } from "./ctxPane.js";

export const TASK_TYPE_TO_MODE = {
  homework: "DEBERES",
  exam: "EXAMEN",
  work: "TRABAJO",
  // Mapeo provisional: en la futura arquitectura multiagente sesion_libre
  // será un modo pedagógico propio (tipos de sesión = modos del mismo agente).
  sesion_libre: "DEBERES",
};

export function enterTask(task, { selectTask }) {
  if (!task) return;
  const mode = TASK_TYPE_TO_MODE[task.type];
  if (!mode) return;
  populateContextPane(task);
  if (typeof selectTask === "function") {
    selectTask(mode, { taskId: task.id, title: task.title, tipo: task.type });
  }
}
