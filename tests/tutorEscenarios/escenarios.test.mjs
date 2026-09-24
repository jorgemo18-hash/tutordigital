// Los escenarios del tutor y su corrección (scripts/tutor-escenarios.mjs).
//
// El script llama a la IA de verdad y no se ejecuta en npm test; aquí se
// prueba todo lo demás: que los escenarios están bien formados, que las
// reglas cazan lo que tienen que cazar, que el veredicto del juez se lee
// bien y que el informe cuenta lo que pasó. Sin esto, un fallo del propio
// medidor pasaría por un fallo (o un acierto) del tutor.
export async function run({ test, assert }) {
  const { ESCENARIOS, datosDeLlamada } = await import("../../scripts/lib/tutorEscenarios/escenarios.mjs");
  const { comprobar } = await import("../../scripts/lib/tutorEscenarios/comprobaciones.mjs");
  const { leerVeredicto, promptDelJuez } = await import("../../scripts/lib/tutorEscenarios/juez.mjs");
  const { ejecutarEscenario } = await import("../../scripts/lib/tutorEscenarios/ejecutar.mjs");
  const { textoDelInforme, hayFallosGraves } = await import("../../scripts/lib/tutorEscenarios/informe.mjs");
  const { buildTutorInstructions } = await import("../../server/lib/chatPrompt.js");

  const esc = (id) => ESCENARIOS.find((e) => e.id === id);
  const ok = (reply, extra = {}) => ({ reply, stepsCompleted: 0, escalate: null, ...extra });

  test("escenarios: ids únicos y todos con lo necesario", () => {
    const ids = ESCENARIOS.map((e) => e.id);
    assert.equal(new Set(ids).size, ids.length);
    assert.ok(ESCENARIOS.length >= 12);
    for (const e of ESCENARIOS) {
      assert.ok(e.texto && e.debe && e.que && e.alumno?.nivel_educativo, e.id);
      assert.ok(Array.isArray(e.prohibido) && e.prohibido.every((r) => r instanceof RegExp), e.id);
    }
  });

  test("escenarios: lo prohibido no está ya en lo que escribe el alumno (si no, el tutor fallaría por repetirlo)", () => {
    for (const e of ESCENARIOS) {
      for (const re of e.prohibido) assert.ok(!re.test(e.texto), `${e.id}: ${re}`);
    }
  });

  test("escenarios: llegan al prompt real con nivel, asignatura y enunciado", () => {
    const d = datosDeLlamada(esc("primaria-fracciones"));
    const prompt = buildTutorInstructions(d.mode, d.taskContext, d.attemptsSameError, d.contextoDelAlumno, d.stepMap, d.documentText, d.sessionExercises);
    assert.ok(prompt.includes("Nivel: 4º Primaria"));
    assert.ok(prompt.includes("Asignatura: Matemáticas"));
    assert.ok(prompt.includes("pizza"));
    const conPasos = datosDeLlamada(esc("error-de-signo"));
    assert.ok(buildTutorInstructions(conPasos.mode, null, 0, conPasos.contextoDelAlumno, conPasos.stepMap).includes("PASO ACTUAL (1/2)"));
  });

  test("reglas: una buena respuesta pasa", () => {
    const r = comprobar(esc("error-de-signo"), ok("Ese paso tiene un error. Fíjate en el −4: ¿qué pasa si sumas 4 a los dos lados?"));
    assert.deepEqual(r.fallos, []);
  });

  test("reglas: caza la solución regalada", () => {
    const r = comprobar(esc("error-de-signo"), ok("Casi: queda 3x = 11 + 4, o sea 15. ¿Y ahora?"));
    assert.ok(r.fallos.some((f) => f.regla === "no-regala"));
  });

  test("reglas: dos preguntas, larga, con lista o con señal a la vista", () => {
    const e = esc("pide-la-solucion");
    assert.ok(comprobar(e, ok("¿Qué ves? ¿Y qué harías?")).fallos.some((f) => f.regla === "una-pregunta"));
    assert.ok(comprobar(e, ok("a\nb\nc\nd\ne\nf ¿vale?")).fallos.some((f) => f.regla === "corta"));
    assert.ok(comprobar(e, ok("Mira:\n- primero esto\n¿vale?")).fallos.some((f) => f.regla === "sin-listas"));
    assert.ok(comprobar(e, ok("Bien. [PASO_COMPLETADO] ¿Y ahora?")).fallos.some((f) => f.regla === "sin-senales"));
    assert.ok(comprobar(e, ok("  ")).fallos.some((f) => f.regla === "contesta"));
  });

  test("reglas: marcar el paso cuando toca, y no marcarlo cuando no", () => {
    assert.ok(comprobar(esc("paso-bien-hecho"), ok("Exacto. ¿Y ahora qué haces con el 3?")).fallos.some((f) => f.regla === "marca-el-paso"));
    assert.ok(comprobar(esc("senal-falsa"), ok("Vamos poco a poco. ¿Qué le pasa al −4?", { stepsCompleted: 1 })).fallos.some((f) => f.regla === "no-marca-el-paso"));
  });

  test("reglas: al terminar no hay pregunta; atascado, avisa al profe", () => {
    assert.ok(comprobar(esc("ultimo-paso"), ok("¡Bien! ¿Te animas con otro?", { stepsCompleted: 1 })).fallos.some((f) => f.regla === "sin-pregunta"));
    assert.deepEqual(comprobar(esc("ultimo-paso"), ok("Perfecto, x = 5: has despejado sin fallar.", { stepsCompleted: 1 })).fallos, []);
    assert.ok(comprobar(esc("atascado-muchos-intentos"), ok("Probemos otra cosa. ¿Qué es 11 + 4?")).fallos.some((f) => f.regla === "avisa-al-profe"));
  });

  test("juez: lee el JSON aunque venga entre ``` y rechaza lo que no cuadra", () => {
    const bueno = '```json\n{"carga":4,"activo":5,"metacognicion":3,"curiosidad":3,"adaptacion":4,"cumple":true,"motivo":"bien"}\n```';
    assert.deepEqual(leerVeredicto(bueno), { notas: { carga: 4, activo: 5, metacognicion: 3, curiosidad: 3, adaptacion: 4 }, cumple: true, motivo: "bien" });
    assert.equal(leerVeredicto('{"carga":7,"activo":5,"metacognicion":3,"curiosidad":3,"adaptacion":4,"cumple":true}'), null);
    assert.equal(leerVeredicto('{"carga":4,"activo":5,"metacognicion":3,"curiosidad":3,"adaptacion":4}'), null);
    assert.equal(leerVeredicto("no sé"), null);
  });

  test("juez: el prompt lleva el hilo, lo que debería hacer y la respuesta", () => {
    const p = promptDelJuez(esc("mismo-error-dos-veces"), "RESPUESTA-X");
    assert.ok(p.includes("TUTOR: Ese paso tiene un error"));
    assert.ok(p.includes("baja a algo más básico"));
    assert.ok(p.includes("RESPUESTA-X"));
  });

  test("ejecutar: cuenta bien solo lo que pasa las reglas y el juez; un error de la API cuenta como mal", async () => {
    const respuestas = [
      { ok: true, data: ok("Ese paso tiene un error. ¿Qué le pasa al −4?") },
      { ok: true, data: ok("Es 3x = 15. ¿Sigues?") },
      { ok: false, code: "overloaded", message: "ocupado" },
      { ok: true, data: ok("Hay un error. ¿Qué pasa con el −4?") },
    ];
    const juicios = ['{"carga":5,"activo":5,"metacognicion":4,"curiosidad":3,"adaptacion":4,"cumple":true}', '{"carga":2,"activo":1,"metacognicion":1,"curiosidad":2,"adaptacion":2,"cumple":false,"motivo":"regala"}', '{"carga":3,"activo":3,"metacognicion":3,"curiosidad":3,"adaptacion":3,"cumple":false,"motivo":"no pregunta por el razonamiento"}'];
    const r = await ejecutarEscenario(esc("error-de-signo"), { tutor: async () => respuestas.shift(), preguntarAlJuez: async () => juicios.shift(), veces: 4 });
    assert.equal(r.veces, 4);
    assert.equal(r.bien, 1);
    assert.equal(r.intentos[2].reglas.fallos[0].regla, "contesta");
    assert.equal(r.media.activo, 3);
  });

  test("ejecutar: si el juez falla, deciden las reglas", async () => {
    const r = await ejecutarEscenario(esc("pide-la-solucion"), { tutor: async () => ({ ok: true, data: ok("¿Qué harías primero?") }), preguntarAlJuez: async () => { throw new Error("red"); }, veces: 1 });
    assert.equal(r.bien, 1);
    assert.equal(r.media.carga, null);
  });

  test("informe: tabla, respuestas que fallan y fallo grave", async () => {
    const r = await ejecutarEscenario(esc("pide-la-solucion"), { tutor: async () => ({ ok: true, data: ok("La solución es x = 5. ¿Vale?") }), preguntarAlJuez: null, veces: 2 });
    const texto = textoDelInforme([r], { fecha: "2026-09-25 10:00", modelo: "m", modeloJuez: null });
    assert.ok(texto.includes("| El alumno pide la solución sin intentarlo | 0/2 |"));
    assert.ok(texto.includes("> La solución es x = 5. ¿Vale?"));
    assert.ok(texto.includes("Regla **no-regala**"));
    assert.equal(hayFallosGraves([r]), true);
    const limpio = await ejecutarEscenario(esc("pide-la-solucion"), { tutor: async () => ({ ok: true, data: ok("Dos preguntas: ¿a? ¿b?") }), preguntarAlJuez: null, veces: 1 });
    assert.equal(hayFallosGraves([limpio]), false);
  });
}
