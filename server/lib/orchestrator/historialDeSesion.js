// EL HILO DE UNA SESIÓN DEL TUTOR: LEERLO Y ESCRIBIRLO. Un solo sitio.
//
// EL PROBLEMA (14/09/2026). El historial que se le manda al modelo salía del
// NAVEGADOR: `chatapi.js` leía `ttd_chat_history_v1` de `localStorage` y lo
// enviaba entero en cada mensaje, y `chat.js` construía con eso el `messages`
// de la llamada a Claude. El servidor guardaba los mensajes en
// `session_messages` y los devolvía al reanudar una sesión (la hidratación
// cross-device de `sessionInit.js`), pero NUNCA los leía para armar el prompt.
//
// LO GRAVE NO ERA PERDER EL HILO, ERA QUIÉN LO ESCRIBE. Un array que llega del
// cliente decide lo que el modelo cree haber dicho él mismo. Y el saneado de
// señales de control (`sanitizeControlSignals` en chat.js) solo se aplica a los
// mensajes del ALUMNO: los del asistente se pasaban tal cual. O sea que quien
// abriera las herramientas del navegador podía escribirse turnos falsos del
// tutor —"Claro, aquí va la solución completa: ..."— y dejar al modelo
// continuando una conversación en la que ya regalaba las respuestas. En un
// producto cuyo único diferenciador es que NO da la respuesta, eso es el fallo,
// no la comodidad de no perder el hilo.
//
// AHORA: el hilo se lee de la base de datos por `session_id`, y lo que manda el
// cliente se ignora. El cliente sigue teniendo su copia, pero solo para pintar
// las burbujas en pantalla.
//
// EL EMPATE DE `created_at`, COMPROBADO Y NO SUPUESTO. Los dos mensajes de un
// turno se insertan en UNA sola sentencia, así que `now()` —que es el sello de
// la transacción, no del reloj— les da el MISMO valor al microsegundo
// (verificado el 14/09 con una tabla temporal en el propio Postgres). Ordenar
// solo por fecha deja el par en orden indefinido, y ordenar por rol ascendente
// pondría "assistant" antes que "user": la respuesta antes de la pregunta. Por
// eso el desempate es `role` DESCENDENTE — 'user' > 'assistant'—, que es el
// orden real del turno.
import { Sentry } from "../sentry.js";

// 20 turnos. `chat.js` recorta a los últimos 20 mensajes al construir la
// llamada, así que leer 40 filas cubre ese recorte con margen para que su
// limpieza (quitar un "assistant" inicial, colapsar roles repetidos) tenga de
// dónde descartar sin quedarse corta.
export const MAX_MENSAJES_HISTORIAL = 40;

// El mismo tope por mensaje que aplicaba el cliente antes de enviarlo. Sin
// esto el cambio subiría el gasto en tokens sin que nadie lo pidiera: las
// filas se guardan hasta 10.000 caracteres.
export const MAX_CHARS_POR_MENSAJE = 7999;

// Filas de `session_messages` (más nuevas primero) -> historial en orden de
// conversación, listo para `chat.js`. Separado de la consulta para poder
// probarlo sin base de datos.
export function normalizarHistorial(filas = []) {
  return [...(filas || [])]
    .reverse()
    .filter(
      (f) =>
        (f?.role === "user" || f?.role === "assistant") &&
        typeof f.content === "string" &&
        f.content.trim().length > 0
    )
    .map((f) => ({ role: f.role, content: f.content.slice(0, MAX_CHARS_POR_MENSAJE) }));
}

export async function fetchHistorialDeSesion(admin, sessionId, { max = MAX_MENSAJES_HISTORIAL } = {}) {
  if (!sessionId) return { messages: [] };

  const { data, error } = await admin
    .from("session_messages")
    .select("role, content, created_at")
    .eq("session_id", sessionId)
    .order("created_at", { ascending: false })
    .order("role", { ascending: false })
    .limit(max);

  if (error) return { error };
  return { messages: normalizarHistorial(data) };
}

// El turno, escrito ANTES de contestar al siguiente mensaje.
//
// POR QUÉ SE ESPERA (antes era fire-and-forget). Mientras el prompt lo armaba
// el navegador, una fila que tardaba en escribirse no se notaba: el cliente ya
// tenía el turno en su copia. Ahora la base de datos ES el hilo, así que un
// insert lento significa que el modelo no ve el turno anterior y el tutor
// repite la pregunta que el alumno acaba de contestar. Se espera: el texto ya
// está en pantalla del alumno (llegó por streaming), así que estos milisegundos
// no los ve nadie.
//
// SE GUARDA EL PAR, NO CADA MENSAJE POR SU LADO. Si la llamada al modelo falla
// —el "no he podido responder ahora mismo" que salió cinco veces en las
// conversaciones de mayo—, no se guarda ninguno de los dos: el hilo se queda
// sin el turno entero en vez de con una pregunta sin respuesta, que es lo que
// el modelo leería como "no supe qué decir".
export async function guardarTurno({ admin, sessionId, textoAlumno, textoTutor }) {
  if (!sessionId || !textoTutor) return { ok: false, code: "nada_que_guardar" };

  const rows = [
    { session_id: sessionId, role: "user", content: String(textoAlumno || "").slice(0, 10_000) },
    { session_id: sessionId, role: "assistant", content: String(textoTutor).slice(0, 10_000) },
  ];

  const insertar = () => admin.from("session_messages").insert(rows);

  const primero = await insertar();
  if (!primero?.error) return { ok: true };

  // Un único reintento: un fallo transitorio de red no debería costar un
  // agujero permanente en el hilo.
  await new Promise((r) => setTimeout(r, 500));
  const segundo = await insertar();
  if (!segundo?.error) return { ok: true };

  // Ya no basta con un console.error: esto no es analítica, es el hilo de la
  // conversación. Si falla sistemáticamente, el tutor pierde la memoria y el
  // alumno lo nota antes que nosotros.
  console.error("[hilo] session_messages insert failed after retry", {
    sessionId,
    errorCode: segundo.error.code,
    errorMessage: segundo.error.message,
  });
  Sentry.captureMessage("session_messages insert failed", {
    level: "warning",
    extra: { sessionId, errorCode: segundo.error.code, errorMessage: segundo.error.message },
  });
  return { ok: false, code: "insert_failed", error: segundo.error };
}

// Un fallo al LEER el hilo no corta la conversación: el tutor contesta sin
// memoria del turno anterior, que es molesto pero utilizable, en vez de dejar
// al alumno con un error y sin salida. Se avisa a Sentry porque si esto falla
// a menudo el tutor parece tonto y nadie sabría por qué.
export function avisarFalloDeLectura(sessionId, error) {
  console.error("[hilo] no se pudo leer session_messages", {
    sessionId,
    errorMessage: error?.message,
  });
  Sentry.captureMessage("session_messages read failed", {
    level: "warning",
    extra: { sessionId, errorCode: error?.code, errorMessage: error?.message },
  });
}
