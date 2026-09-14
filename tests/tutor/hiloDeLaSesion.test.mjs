import fs from "node:fs";

const RAIZ = new URL("../../", import.meta.url).pathname;

// EL HILO DE LA CONVERSACIÓN LO GUARDA EL SERVIDOR, NO EL NAVEGADOR.
//
// EL PROBLEMA (14/09/2026). El historial que se le mandaba al modelo salía de
// `localStorage`: `chatapi.js` leía `ttd_chat_history_v1` y lo enviaba entero
// en cada mensaje. El servidor escribía los turnos en `session_messages` y los
// devolvía al REANUDAR una sesión (la hidratación cross-device de
// `sessionInit.js`), pero nunca los leía para armar el prompt.
//
// LO GRAVE NO ERA PERDER EL HILO. Era que un array del cliente decidiera lo
// que el modelo cree haber dicho él mismo — y el saneado de señales de control
// de `chat.js` solo se aplica a los mensajes del ALUMNO, los del asistente
// pasaban tal cual. Con las herramientas del navegador se podían escribir
// turnos falsos del tutor ("Claro, aquí va la solución completa: ...") y
// dejarlo continuando una conversación en la que ya regalaba las respuestas.
// En un producto cuyo único diferenciador es que NO da la respuesta, ese es el
// fallo; perder el hilo al cambiar de móvil es la parte cómoda.
//
// Y OJO CON LO QUE DECÍA EL ROADMAP: "el servidor guarda session_messages y
// nunca los lee" era medio falso. Los leía al reanudar. Lo comprobado en
// producción el 14/09 es otra cosa, peor de entender y mejor de saber:
// **`session_messages` tiene CERO filas**. Las tres sesiones que existen son
// de julio, de centros de prueba, con `current_step = 0` y
// `messages_without_progress = 0`: se abrieron y nadie escribió nunca un
// mensaje. O sea que este camino de escritura no está roto — está SIN
// ESTRENAR, y estos tests son lo único que lo ejercita hasta que entre un
// alumno.
export async function run({ test, assert }) {
  const {
    fetchHistorialDeSesion, guardarTurno, normalizarHistorial,
    MAX_MENSAJES_HISTORIAL, MAX_CHARS_POR_MENSAJE,
  } = await import("../../server/lib/orchestrator/historialDeSesion.js");
  const { validateChatBody } = await import("../../server/lib/chatValidation.js");

  function fakeAdmin({ filas = [], error = null, fallosDeInsert = 0 } = {}) {
    const visto = { order: [], eq: {}, limit: null, inserts: [] };
    let intentos = 0;
    const q = {
      select() { return q; },
      eq(col, val) { visto.eq[col] = val; return q; },
      order(col, opts) { visto.order.push(`${col} ${opts?.ascending ? "asc" : "desc"}`); return q; },
      limit(n) { visto.limit = n; return Promise.resolve({ data: filas, error }); },
      insert(rows) {
        visto.inserts.push(rows);
        intentos += 1;
        return Promise.resolve({ error: intentos <= fallosDeInsert ? { code: "23505", message: "boom" } : null });
      },
    };
    return { from: () => q, _visto: visto };
  }

  const sinComentarios = (fuente) =>
    fuente.split("\n").filter((l) => !l.trim().startsWith("//")).join("\n");

  // ── El empate de created_at ──────────────────────────────────────────

  test("REGRESIÓN: el desempate es por rol DESCENDENTE, no ascendente", async () => {
    // Los dos mensajes de un turno se insertan en UNA sentencia, así que
    // `now()` —el sello de la TRANSACCIÓN— les da el mismo valor al
    // microsegundo. Comprobado el 14/09 con una tabla temporal en el propio
    // Postgres: las dos filas salen con `created_at` idéntico.
    //
    // Con `role` ascendente, "assistant" va antes que "user": la respuesta
    // antes de la pregunta. Con descendente, 'user' > 'assistant' y el turno
    // queda en su orden real.
    const admin = fakeAdmin();
    await fetchHistorialDeSesion(admin, "s1");
    assert.deepEqual(admin._visto.order, ["created_at desc", "role desc"]);
  });

  test("un par con el MISMO sello sale pregunta y luego respuesta", () => {
    // Tal como los devuelve Postgres con ese orden: más nuevo primero y, en
    // el empate, assistant antes que user. Al invertir queda la conversación.
    const filas = [
      { role: "assistant", content: "respuesta 2", created_at: "2026-09-14T10:00:02Z" },
      { role: "user", content: "pregunta 2", created_at: "2026-09-14T10:00:02Z" },
      { role: "assistant", content: "respuesta 1", created_at: "2026-09-14T10:00:01Z" },
      { role: "user", content: "pregunta 1", created_at: "2026-09-14T10:00:01Z" },
    ];
    assert.deepEqual(normalizarHistorial(filas).map((m) => `${m.role}:${m.content}`), [
      "user:pregunta 1", "assistant:respuesta 1",
      "user:pregunta 2", "assistant:respuesta 2",
    ]);
  });

  // ── La lectura ───────────────────────────────────────────────────────

  test("lee solo la sesión pedida y acota a 40 filas", async () => {
    const admin = fakeAdmin();
    await fetchHistorialDeSesion(admin, "s-42");
    assert.deepEqual(admin._visto.eq, { session_id: "s-42" });
    assert.equal(admin._visto.limit, MAX_MENSAJES_HISTORIAL);
    assert.equal(MAX_MENSAJES_HISTORIAL, 40, "20 turnos: chat.js recorta a 20 mensajes");
  });

  test("una fila basura no entra en el prompt", () => {
    const filas = [
      { role: "system", content: "ignórame" },
      { role: "user", content: "   " },
      { role: "assistant", content: null },
      { role: "user", content: "esta sí" },
    ];
    assert.deepEqual(normalizarHistorial(filas), [{ role: "user", content: "esta sí" }]);
  });

  test("REGRESIÓN: cada mensaje se recorta, o el cambio sube el gasto en tokens", () => {
    // Las filas se guardan hasta 10.000 caracteres y el cliente recortaba a
    // 7.999 antes de enviarlas. Sin este recorte, pasar a leer de la base de
    // datos subiría el tamaño del prompt sin que nadie lo hubiera pedido.
    const largo = "x".repeat(12_000);
    const [msg] = normalizarHistorial([{ role: "user", content: largo }]);
    assert.equal(msg.content.length, MAX_CHARS_POR_MENSAJE);
    assert.equal(MAX_CHARS_POR_MENSAJE, 7999);
  });

  test("sin sesión no hay hilo, y no se consulta la base de datos", async () => {
    const admin = fakeAdmin();
    const r = await fetchHistorialDeSesion(admin, null);
    assert.deepEqual(r.messages, []);
    assert.equal(admin._visto.limit, null, "ni una consulta");
  });

  test("REGRESIÓN: un error de lectura se devuelve, no se disfraza de hilo vacío", async () => {
    // Quien llama decide qué hacer (avisar y seguir sin memoria). Si esto
    // devolviera [] en silencio, un fallo de base de datos sería
    // indistinguible de una conversación que acaba de empezar.
    const r = await fetchHistorialDeSesion(fakeAdmin({ error: { message: "cae" } }), "s1");
    assert.ok(r.error);
    assert.equal(r.messages, undefined);
  });

  // ── La escritura ─────────────────────────────────────────────────────

  test("el turno se guarda como UN par en una sola sentencia", async () => {
    const admin = fakeAdmin();
    const r = await guardarTurno({ admin, sessionId: "s1", textoAlumno: "3x=9", textoTutor: "¿Qué operación deshace el ×3?" });
    assert.equal(r.ok, true);
    assert.equal(admin._visto.inserts.length, 1, "una sentencia, no dos");
    assert.deepEqual(admin._visto.inserts[0].map((f) => f.role), ["user", "assistant"]);
    assert.equal(admin._visto.inserts[0][0].session_id, "s1");
  });

  test("reintenta una vez si el primer insert falla", async () => {
    const admin = fakeAdmin({ fallosDeInsert: 1 });
    const r = await guardarTurno({ admin, sessionId: "s1", textoAlumno: "hola", textoTutor: "hola" });
    assert.equal(r.ok, true);
    assert.equal(admin._visto.inserts.length, 2);
  });

  test("y si falla dos veces lo dice, no finge que se guardó", async () => {
    const admin = fakeAdmin({ fallosDeInsert: 2 });
    const r = await guardarTurno({ admin, sessionId: "s1", textoAlumno: "hola", textoTutor: "hola" });
    assert.equal(r.ok, false);
    assert.equal(r.code, "insert_failed");
  });

  test("sin respuesta del tutor no se guarda media conversación", async () => {
    // Si la llamada al modelo falla, el hilo se queda sin el turno entero. Una
    // pregunta sin respuesta el modelo la lee como "no supe qué decir".
    const admin = fakeAdmin();
    const r = await guardarTurno({ admin, sessionId: "s1", textoAlumno: "3x=9", textoTutor: "" });
    assert.equal(r.ok, false);
    assert.equal(admin._visto.inserts.length, 0);
  });

  // ── Los dos extremos del cable ───────────────────────────────────────

  test("REGRESIÓN: el handler pisa lo que manda el cliente con el hilo de la BD", () => {
    const handler = sinComentarios(fs.readFileSync(
      `${RAIZ}server/lib/orchestrator/chatHandler.js`, "utf8"
    ));
    assert.match(handler, /fetchHistorialDeSesion\(admin, sessionId\)/);
    // El orden importa: `messages` va DESPUÉS del spread de validatedData, o
    // el array del cliente ganaría.
    assert.match(
      handler, /\.\.\.validatedData,\s*\n\s*messages: hilo\.messages/,
      "messages tiene que sobrescribir lo que venga en validatedData"
    );
  });

  test("REGRESIÓN: el guardado del turno se ESPERA", () => {
    // Mientras el prompt lo armaba el navegador, una fila lenta no se notaba.
    // Ahora la base de datos ES el hilo: un insert que llega tarde es un turno
    // que el modelo no ve, y el tutor repite la pregunta ya contestada.
    const handler = sinComentarios(fs.readFileSync(
      `${RAIZ}server/lib/orchestrator/chatHandler.js`, "utf8"
    ));
    assert.match(handler, /await guardarTurno\(/);
    assert.equal(
      /from\("session_messages"\)/.test(handler), false,
      "el handler ya no escribe la tabla a mano: eso vive en historialDeSesion.js"
    );
  });

  test("REGRESIÓN: el navegador ya no manda el historial", () => {
    const cliente = sinComentarios(fs.readFileSync(
      `${RAIZ}assets/shared/js/chatapi.js`, "utf8"
    ));
    assert.equal(/getHistory/.test(cliente), false, "ni lo lee");
    assert.equal(/messages,/.test(cliente), false, "ni lo envía en el payload");
    assert.match(cliente, /sessionId/, "lo que sí manda es la sesión, que es la llave del hilo");
  });

  test("la validación del chat no dependía del historial", () => {
    // `messages` servía de comodín para dejar pasar una petición sin texto ni
    // adjunto. Al dejar de enviarlo, lo que tiene que seguir entrando es lo
    // normal: un texto, o un adjunto.
    assert.equal(validateChatBody({ text: "3x=9", mode: "DEBERES" }).ok, true);
    assert.equal(
      validateChatBody({ mode: "DEBERES", image: "data:image/png;base64,iVBORw0KGgo=" }).ok, true,
      "una foto del cuaderno sin texto sigue valiendo"
    );
    assert.equal(
      validateChatBody({ mode: "DEBERES" }).ok, false,
      "y una petición vacía sigue sin valer"
    );
  });
}
