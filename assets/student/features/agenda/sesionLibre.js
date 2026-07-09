// Sesión libre: sesión de tutor sin tarea asignada por un profesor (alumno
// de academia que sube sus propios deberes). El backend crea o reutiliza
// una tarea de sistema (POST /api/v1/tasks/sesion-libre) — aquí se entra al
// tutor con ella replicando los dos pasos que hace handleCardClick al
// clicar una tarjeta de la agenda (studentAgendaTeacherTasks.js): primero
// populateContextPane(task) (cablea "Adjuntar archivo" con el taskId real
// y pinta la columna ENUNCIADO), luego selectTaskRef (hilo de chat,
// showTutor con el título real, initSession). selectTaskRef por sí solo
// NO llama a populateContextPane — solo handleCardClick lo hacía, y este
// flujo no pasa por ahí.
export async function startSesionLibre({ apiFetch, selectTaskRef, populateContextPane }) {
  try {
    const res = await apiFetch("/api/v1/tasks/sesion-libre", { method: "POST" });
    if (!res.ok) {
      console.error("[sesionLibre] petición no OK:", res.status);
      return;
    }
    const body = await res.json().catch(() => ({}));
    const task = body?.data?.task;
    if (!task?.id) return;

    populateContextPane(task);
    await selectTaskRef("deberes", { taskId: task.id, title: task.title, tipo: "sesion_libre" });
  } catch (err) {
    console.error("[sesionLibre] No se pudo iniciar la sesión libre:", err?.message);
  }
}
