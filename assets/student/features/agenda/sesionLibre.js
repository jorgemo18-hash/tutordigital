// Sesión libre: sesión de tutor sin tarea asignada por un profesor (alumno
// de academia que sube sus propios deberes). El backend crea o reutiliza
// una tarea de sistema (POST /api/v1/tasks/sesion-libre) — aquí se entra
// al tutor con ella por el MISMO camino que una tarjeta de agenda
// (enterTask, compartido con handleCardClick), en vez de reproducir sus
// pasos a mano: eso era, en sí mismo, un camino paralelo con sus propios
// bugs (listener del botón, disparo del picker post-subida, drop).
import { enterTask } from "./enterTask.js";

export async function startSesionLibre({ apiFetch, selectTaskRef, onFailure }) {
  try {
    const res = await apiFetch("/api/v1/tasks/sesion-libre", { method: "POST" });
    if (!res.ok) {
      console.error("[sesionLibre] petición no OK:", res.status);
      onFailure?.();
      return;
    }
    const body = await res.json().catch(() => ({}));
    const task = body?.data?.task;
    if (!task?.id) {
      onFailure?.();
      return;
    }

    enterTask(task, { selectTask: selectTaskRef });
  } catch (err) {
    console.error("[sesionLibre] No se pudo iniciar la sesión libre:", err?.message);
    onFailure?.();
  }
}
