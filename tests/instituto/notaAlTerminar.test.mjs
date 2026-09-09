import { Window } from "happy-dom";

const window = globalThis.window || new Window();
globalThis.window = window;
globalThis.document = window.document;

// La nota al profesor se ofrece AL TERMINAR, no solo a medias.
//
// EL FALLO (09/09/2026, comprobado contra producción: 0 filas en
// student_notes desde que existe la tabla). El botón "Nota al profesor" se
// enseñaba durante el ejercicio, y `onFinished` hacía `hideNotaRow()`: al
// pulsar "He terminado" o "No he podido" desaparecía. Es decir, el alumno
// solo podía escribir mientras estaba a medias, y nunca en el momento en que
// sabe qué contar. Todo el circuito estaba montado —el módulo, la ruta, la
// tabla, y el profesor viéndolas en su cuaderno— y no llegó ni una.
//
// EL DISEÑO (Jorge, 09/09): "que salga el he terminado, luego he podido o no
// he podido, y con cada una de ellas que se abra un enviar nota al
// profesor... que sea opcional".
//
// Y DE PASO SE QUITÓ EL TICKET, que era un segundo canal para lo mismo: 32
// en producción, los 32 sin `student_id`, con la conversación copiada en un
// campo de texto y sin enlace a la sesión.
export async function run({ test, assert }) {
  const { createOnFinished } = await import(
    "../../assets/student/controllers/onFinished.js"
  );

  function montar({ kind = "resolved", sessionId = "s-1" } = {}) {
    const llamadas = [];
    const notas = [];
    const onFinished = createOnFinished({
      getActiveTaskContext: () => ({ id: "t-1", title: "Fracciones", subject: "Mates", attachments: [] }),
      getActiveSessionId: () => sessionId,
      ACTIVE_USER: { userId: "al-1" },
      metaMode: { getSessionSeconds: () => 42 },
      // clearActiveSession se llama SIEMPRE, y a partir de ahí
      // getActiveSessionId ya no sirve: por eso la nota necesita el id fijado.
      clearActiveSession: () => { sessionId = null; },
      clearSessionCache: () => {},
      stepMapPanel: { hide() {} },
      exercisePicker: { hide() {} },
      stepsPlaceholder: null,
      setCtxAttachment: () => {},
      add: () => {},
      apiFetch: async (url, opts) => {
        llamadas.push({ url, body: JSON.parse(opts?.body || "{}") });
        return { ok: true, json: async () => ({}) };
      },
      showNotaRow: (opts) => notas.push(opts),
    });
    return { onFinished: () => onFinished(kind), llamadas, notas };
  }

  test("REGRESIÓN: al RESOLVER se ofrece la nota, no se esconde", async () => {
    const { onFinished, notas } = montar({ kind: "resolved" });
    await onFinished();
    assert.equal(notas.length, 1, "no se ha ofrecido la nota");
    assert.equal(notas[0].abierto, true, "el panel tiene que abrirse: si no, nadie lo pulsa");
  });

  test("REGRESIÓN: al NO PODER también se ofrece", async () => {
    const { onFinished, notas } = montar({ kind: "stuck" });
    await onFinished();
    assert.equal(notas.length, 1);
    assert.equal(notas[0].abierto, true);
  });

  test("REGRESIÓN: la nota se ata a la sesión ANTES de que se limpie", async () => {
    // clearActiveSession() corre en el mismo turno: si la nota dependiera de
    // getActiveSessionId(), el alumno escribiría y se perdería en silencio
    // (el módulo hace `if (!sessionId) return;`).
    const { onFinished, notas } = montar({ sessionId: "s-99" });
    await onFinished();
    assert.equal(notas[0].sessionId, "s-99");
  });

  test("la pregunta cambia según lo que haya pasado", async () => {
    // No se cuenta lo mismo cuando has podido que cuando te has atascado.
    const resuelto = montar({ kind: "resolved" });
    await resuelto.onFinished();
    const atascado = montar({ kind: "stuck" });
    await atascado.onFinished();
    assert.notEqual(resuelto.notas[0].pista, atascado.notas[0].pista);
    assert.match(resuelto.notas[0].pista, /opcional/i, "tiene que quedar claro que no es obligatorio");
    assert.match(atascado.notas[0].pista, /opcional/i);
  });

  test("REGRESIÓN: ya no se crea ningún ticket", async () => {
    for (const kind of ["resolved", "stuck"]) {
      const { onFinished, llamadas } = montar({ kind });
      await onFinished();
      const tickets = llamadas.filter((l) => String(l.url).includes("/tickets"));
      assert.deepEqual(tickets, [], `con kind="${kind}" se ha creado un ticket`);
    }
  });

  test("lo que sí se sigue haciendo: marcar la tarea y cerrar la sesión con su resultado", async () => {
    // El aviso al profesor no depende de la nota: viaja en la sesión.
    const { onFinished, llamadas } = montar({ kind: "stuck" });
    await onFinished();

    const tarea = llamadas.find((l) => l.url === "/api/v1/tasks");
    assert.equal(tarea.body.student_status, "needs_teacher");

    const sesion = llamadas.find((l) => String(l.url).includes("/tutor-sessions/"));
    assert.equal(sesion.body.outcome, "abandoned");
    assert.equal(sesion.body.needs_help, true, "es lo que enciende el contador del cuaderno del profesor");
  });

  test("al resolver, la sesión se cierra como completada y sin aviso", async () => {
    const { onFinished, llamadas } = montar({ kind: "resolved" });
    await onFinished();
    const sesion = llamadas.find((l) => String(l.url).includes("/tutor-sessions/"));
    assert.equal(sesion.body.outcome, "completed");
    assert.equal(sesion.body.needs_help, false);
  });

  test("sin sesión activa no se abre el panel: una nota sin sesión no se puede guardar", async () => {
    const { onFinished, notas } = montar({ sessionId: null });
    await onFinished();
    assert.equal(notas[0].abierto, false, "abrirlo sería invitar a escribir algo que se va a perder");
  });
}
