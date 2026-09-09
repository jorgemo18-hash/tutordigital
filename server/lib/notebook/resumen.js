// Piezas compartidas por las dos rutas del cuaderno: `notebook.routes.js`
// (las notas de un alumno) y `notebookSummary.routes.js` (el resumen de un
// grupo).
//
// POR QUÉ EXISTE ESTE ARCHIVO. El 09/09/2026 se separó /summary a su propio
// archivo por responsabilidad, y la separación se hizo mal: el handler se
// movió y estas tres funciones se quedaron atrás. El archivo nuevo las
// llamaba sin tenerlas, así que `GET /api/v1/notebook/summary` lanzaba un
// ReferenceError y respondía 500. Estuvo así en producción hasta que se
// detectó ese mismo día.
//
// No lo cazó nada: `node --check` solo mira sintaxis, ESLint no tenía
// activada `no-undef` (ahora sí), los tests no ejercitan esa ruta y el smoke
// de UI mockea la API. Un identificador que no existe no es un error de
// parseo — solo revienta cuando esa línea se ejecuta.
//
// La lección para la próxima extracción: al mover un handler a otro archivo,
// lo que hay que mirar no es si el handler está entero, sino qué usa que se
// quede fuera.

export function toIsoDateStart(dateStr) {
  return `${dateStr}T00:00:00.000Z`;
}

export function toIsoDateEnd(dateStr) {
  return `${dateStr}T23:59:59.999Z`;
}

// El semáforo de cada alumno en el resumen del grupo.
//
// `ayudaPendiente` es lo que el alumno ha escalado y nadie ha atendido
// todavía. Manda sobre todo lo demás: da igual que tenga las tareas al día
// si está esperando a que alguien le conteste.
export function statusForSummary({ tasks_total, tasks_done, ayudaPendiente }) {
  if (ayudaPendiente > 0) return "necesita";
  if (tasks_total > 0 && tasks_done < tasks_total) return "pendiente";
  return "ok";
}
