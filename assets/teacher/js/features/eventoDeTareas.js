// "HAN CAMBIADO LAS TAREAS DEL PROFESOR": lo avisa quien crea una tarea
// fuera de la Agenda (Recursos → "Poner como deberes") para que la Agenda y
// el Cuaderno la enseñen sin recargar la página. Lo escuchan teacher.js
// (escritorio) y mobileTeacherAgenda.js (móvil).
export const EVENTO_TAREAS = "ttd:tareas";

export function avisarCambioDeTareas(doc = globalThis.document) {
  doc?.dispatchEvent?.(new doc.defaultView.CustomEvent(EVENTO_TAREAS));
}
