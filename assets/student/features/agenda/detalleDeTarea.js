// LO QUE EL PROFESOR PUSO EN LA TAREA, TAL COMO LO TIENE QUE VER EL ALUMNO.
//
// La descripción que el profesor escribe al crear una tarea llegaba al tutor
// (exerciseSelection la mete en el prompt) pero el alumno no la veía en
// ningún sitio: en el ordenador el hueco existía (#ctxTaskDesc) y nadie lo
// rellenaba; en el móvil el título de la tarea lleva una flecha ⌄ que
// promete un detalle y no abría nada. El tutor sabía qué pedía el profesor y
// el alumno no.
//
// Solo datos: quién lo pinta (panel del ordenador, hoja del móvil) es cosa
// de cada uno.

function fechaCorta(iso) {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(iso || ""));
  return m ? `${m[3]}/${m[2]}/${m[1]}` : "";
}

export function detalleDeTarea(task) {
  if (!task) return null;
  const adjuntos = (Array.isArray(task.attachments) ? task.attachments : [])
    .filter((a) => a && a.id)
    .map((a) => ({ id: a.id, nombre: a.file_name || a.name || "Archivo" }));
  return {
    titulo: task.title || "",
    entrega: fechaCorta(task.dueDate || task.due_date),
    descripcion: String(task.desc || task.description || "").trim(),
    notas: String(task.teacherNotes || task.teacher_notes || "").trim(),
    adjuntos,
  };
}
