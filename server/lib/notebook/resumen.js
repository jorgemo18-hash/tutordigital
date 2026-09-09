// Las cuentas del resumen del cuaderno, fuera del handler que las sirve
// (`notebookSummary.routes.js`), para poder probarlas sin base de datos.
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
//
// (Las dos que convertían una fecha YMD en instante ISO se han ido con la
// consulta a `tickets` que las usaba: `tutor_sessions.session_date` ya es
// una fecha, así que se compara tal cual.)

// Cuántas peticiones de ayuda tiene cada alumno, pendientes y atendidas.
//
// LA UNIDAD NO ES LA SESIÓN, ES EL INTENTO. Un alumno que se atasca tres
// veces con la misma tarea el mismo día no son tres avisos para el profesor:
// es uno. La clave (alumno, tarea, día) es exactamente la que usa
// PATCH /tutor-sessions/:id/review para marcar como visto, así que contar por
// ella es lo único que hace que el número baje a cero cuando el profesor
// pulsa "revisado" una vez.
//
// Las sesiones sin tarea (chat libre) no se agrupan: cada una es su aviso.
export function contarAyudaPorAlumno(sesiones = []) {
  // Primero se agrupa, y solo después se cuenta: si de las tres sesiones de
  // una misma unidad hay una sin revisar, la unidad entera sigue pendiente.
  // Contando sobre la marcha, el resultado dependería del orden en que la
  // base de datos devolviera las filas.
  const unidades = new Map(); // clave -> { alumnoId, revisada }

  for (const s of sesiones || []) {
    const alumnoId = s?.student_id;
    if (!alumnoId) continue;
    const unidad = s.task_id ? `${s.task_id}|${s.session_date}` : `libre|${s.id}`;
    const clave = `${alumnoId}|${unidad}`;
    const previa = unidades.get(clave);
    const revisada = Boolean(s.teacher_reviewed);
    if (previa) previa.revisada = previa.revisada && revisada;
    else unidades.set(clave, { alumnoId, revisada });
  }

  const pendiente = new Map();
  const atendida = new Map();
  for (const { alumnoId, revisada } of unidades.values()) {
    const destino = revisada ? atendida : pendiente;
    destino.set(alumnoId, (destino.get(alumnoId) || 0) + 1);
  }

  return { pendiente, atendida };
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
