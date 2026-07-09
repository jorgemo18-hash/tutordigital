// Verifica que una tarea pertenece a un alumno concreto — por grupo (tareas
// normales, asignadas por un profesor a todo el grupo) o por student_id
// (tareas de sistema propias del alumno sin grupo, p.ej. sesión libre).
// Usado por /api/v1/attachments y /api/v1/session/start, que antes de esto
// solo comprobaban que la tarea existiera en el tenant — sin esto, un
// alumno podía adjuntar/arrancar sesión en la tarea de otro pasando su UUID.
export async function taskBelongsToStudent(admin, { tenantId, taskId, student }) {
  if (!student) return false;
  const { data: task } = await admin
    .from("tasks")
    .select("id, group_id, student_id")
    .eq("id", taskId)
    .eq("tenant_id", tenantId)
    .maybeSingle();
  if (!task) return false;
  if (task.group_id) return task.group_id === student.group_id;
  if (task.student_id) return task.student_id === student.id;
  return false;
}
