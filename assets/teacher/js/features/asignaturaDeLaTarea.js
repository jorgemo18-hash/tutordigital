// LA ASIGNATURA DE UNA TAREA NUEVA: se elige, no se hereda sin avisar.
//
// En las conversaciones reales de mayo-junio, cinco tareas etiquetadas
// «Educación Física» eran sintaxis, logaritmos e inglés. La causa: el
// selector de la cabecera arranca en la PRIMERA asignatura del grupo (no
// tiene "todas"), y "Nueva tarea" copiaba esa asignatura en el formulario.
// Quien no se fijaba creaba la tarea con la asignatura de la cabecera. Y el
// tutor usa esa asignatura para saber de qué va el ejercicio.
//
// Ahora: con UNA asignatura posible se pone sola (no hay nada que elegir);
// con varias, el campo empieza vacío y es obligatorio.
export function asignaturasDelSelector(select) {
  return [...(select?.options || [])].map((o) => o.value).filter(Boolean);
}

export function asignaturaInicial(opciones) {
  return opciones.length === 1 ? opciones[0] : "";
}

export function errorDeAsignatura(opciones, valor) {
  if (opciones.length < 2 || valor) return null;
  return "Elige la asignatura: el tutor la usa para saber de qué va el ejercicio.";
}
