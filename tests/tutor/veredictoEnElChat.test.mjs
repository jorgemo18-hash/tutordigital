// EL COMPROBADOR DENTRO DEL CHAT: una hoja de Álgebra de verdad (del
// generador), mensajes de alumno de verdad y la escalera de ayuda.
export async function run({ test, assert }) {
  const { ALGEBRA_1ESO } = await import("../../server/lib/generadorEjercicios/temas/algebra1eso.js");
  const { crearAzar } = await import("../../server/lib/generadorEjercicios/aleatorio.js");
  const { respuestasDe } = await import("../../server/lib/generadorEjercicios/errores/trampasDelApartado.js");
  const { actividadesDeLaHoja, analisisDeLaHoja, hojaConMetodo, textoDeLaHoja } = await import("../../server/lib/tutor/hoja/fichaDeHoja.js");
  const { comprobarMensaje } = await import("../../server/lib/tutor/veredicto.js");
  const { instruccionesParaElTutor } = await import("../../server/lib/tutor/escalera.js");
  const { aplicarVeredicto } = await import("../../server/lib/orchestrator/comprobadorEnElChat.js");
  const { ejemploParecido } = await import("../../server/lib/tutor/hoja/ejemploParecido.js");

  const TEMA = ALGEBRA_1ESO.id;
  const bateria = (clave) => Object.values(ALGEBRA_1ESO.baterias).flat().find((b) => b.clave === clave);
  const hueco = (clave, semilla, cuantos = 3) => {
    const ej = bateria(clave).generador(crearAzar(semilla), { cuantos });
    return { clave, nombre: ej.arquetipo, respuestas: respuestasDe({ ...ej, clave }) };
  };
  // Una hoja con dos actividades, como la guarda el panel: ecuaciones de dos
  // pasos y con paréntesis. Se fijan los apartados para saber qué esperar.
  const dosPasos = { clave: "ecuacion_dos_pasos", nombre: "Resuelve ecuaciones de la forma ax + b = c", respuestas: [
    { ejemplo: true, texto: "2x + 1 = 7 → x = ___", solucion: "3", trampas: [] },
    { texto: "3x + 4 = 19 → x = ___", solucion: "5", trampas: [{ error: 5, respuesta: String(23 / 3) }] },
    { texto: "5x − 2 = 18 → x = ___", solucion: "4", trampas: [] },
  ] };
  const hoja = { hojaId: "h1", temaId: TEMA, actividades: actividadesDeLaHoja({ temaId: TEMA, huecos: [dosPasos, hueco("ecuacion_con_parentesis", "p1")] }) };
  const act = hoja.actividades[0];
  const comprobar = (texto, extra = {}) => comprobarMensaje({ texto, actividad: act, ...extra });

  test("la hoja guardada da los ejercicios, sin el ejemplo, con su referencia y su método", () => {
    assert.equal(act.apartados.length, 2, "el ejemplo resuelto no cuenta");
    assert.deepEqual(act.apartados[0].referencia, { tipo: "ecuacion", ecuacion: "3*x+4=19", enunciado: "3x + 4 = 19" });
    assert.ok(act.metodo.hitos.length === 2);
    assert.equal(hojaConMetodo(hoja), true);
    const a = analisisDeLaHoja(hoja);
    assert.equal(a.needsChoice, true);
    assert.deepEqual(a.exercises.map((e) => e.index), [1, 2]);
    assert.match(textoDeLaHoja(hoja), /a\) 3x \+ 4 = 19 → x = ___/);
    assert.deepEqual(a.usageEvents, [], "sin IA");
  });

  test("respuestasDe guarda el texto plano de cada apartado (lo que lee el comprobador)", () => {
    const h = hueco("ecuacion_dos_pasos", "t1");
    assert.ok(h.respuestas.every((r) => typeof r.texto === "string" && r.texto.includes("→")));
  });

  test("bien: todos los pasos hechos y el tutor solo felicita", () => {
    const v = comprobar("a) 3x = 19 − 4\n3x = 15\nx = 5");
    assert.equal(v.estado, "comprobado");
    assert.equal(v.todoHecho, true);
    assert.equal(v.nivel, 0);
    assert.match(instruccionesParaElTutor(v), /Está bien y comprobado/);
  });

  test("REGRESIÓN (el signo del 1/10): un paso mal no se da por bueno, y la escalera sube un peldaño por fallo", () => {
    const texto = "3x = 19 + 4\n3x = 23\nx = 23/3";
    const v1 = comprobar(texto);
    assert.equal(v1.apartado, 0, "reconocido por la primera línea, sin decir el apartado");
    assert.equal(v1.todoHecho, false);
    assert.equal(v1.nivel, 1);
    const t1 = instruccionesParaElTutor(v1);
    assert.match(t1, /no des por buena una línea que el código marca mal/);
    assert.match(t1, /PELDAÑO 1 de 4/);
    assert.match(t1, /NO le digas cuál es el error/);
    assert.doesNotMatch(t1, /x = 5/, "no le pasa la solución a la IA");

    const v2 = comprobar(texto, { fallosPrevios: () => 1, describirError: (n) => (n === 5 ? { nombre: "Pasa un término sin cambiarle el signo", descripcion: "…" } : null) });
    assert.equal(v2.nivel, 2);
    assert.match(instruccionesParaElTutor(v2), /PELDAÑO 2 de 4.*Pasa un término sin cambiarle el signo/s);

    const v3 = comprobar(texto, { fallosPrevios: () => 2, ejemplo: (t) => ejemploParecido({ temaId: TEMA, clave: act.clave, distintoDe: t, semilla: "x" }) });
    assert.equal(v3.nivel, 3);
    assert.ok(v3.ejemplo && v3.ejemplo.texto !== act.apartados[0].texto, "un ejemplo con otros números");
    assert.match(instruccionesParaElTutor(v3), /Toca ENSEÑAR/);

    const v4 = comprobar(texto, { fallosPrevios: () => 3 });
    assert.equal(v4.nivel, 4);
    assert.match(instruccionesParaElTutor(v4), /se lo decís a su profe/);
  });

  test("el apartado: si lo dice, ese; si no se sabe, se pregunta; sin cuentas, no hay veredicto", () => {
    assert.equal(comprobar("b) 5x = 20").apartado, 1);
    const desconocido = comprobar("x = 9");
    assert.equal(desconocido.estado, "apartado_desconocido");
    assert.match(instruccionesParaElTutor(desconocido), /Pregúntale qué apartado/);
    assert.equal(comprobar("no sé por dónde empezar").estado, "sin_cuentas");
  });

  test("lo que no es una cuenta no se corrige: se ignora, nunca sale como fallo", () => {
    const v = comprobar("a) 3x = 15\nx = ¿5?");
    assert.equal(v.comprobacion.primeraMal, null);
    assert.deepEqual(v.hitos.map((h) => h.estado), ["hecho", "pendiente"]);
  });

  test("sin decir el apartado, sigue con el que dejó a medias", () => {
    assert.equal(comprobar("x = 9").estado, "apartado_desconocido");
    assert.equal(comprobar("x = 9", { abierto: 1 }).apartado, 1);
  });

  function adminDeMentira() {
    const escrito = { intentos: [], mapas: [], sesiones: [] };
    const admin = { from: (tabla) => ({
      insert: async (fila) => { escrito.intentos.push(fila); return { error: null }; },
      update: (cambios) => ({ eq: async () => { (tabla === "tutor_sessions" ? escrito.sesiones : escrito.mapas).push(cambios); return { error: null }; } }),
    }) };
    return { admin, escrito };
  }

  test("después de la IA: los pasos los marca el código, se guarda el intento y en el peldaño 4 se avisa a la profe", async () => {
    const { admin, escrito } = adminDeMentira();
    const prep = { hoja, actividad: act, comprobable: true, v: comprobar("3x = 15"), apartadosHechos: new Set() };
    const r = await aplicarVeredicto({ admin, tenantId: "c", sessionId: "s", prep, pasosAntes: [] });
    assert.deepEqual(r.stepMap.steps.map((s) => s.completed), [true, false]);
    assert.equal(r.avance, 1);
    assert.equal(escrito.intentos[0].hito_mal, null);
    assert.equal(escrito.sesiones.length, 0);

    const mal = { ...prep, v: comprobar("3x = 19 + 4", { fallosPrevios: () => 3 }) };
    const r4 = await aplicarVeredicto({ admin, tenantId: "c", sessionId: "s", prep: mal, pasosAntes: [] });
    assert.equal(r4.resumen.escalado, true);
    assert.equal(escrito.sesiones[0].needs_help, true);
    assert.match(escrito.sesiones[0].escalation_reason, /apartado a\)/);
    assert.equal(escrito.intentos[1].error_numero, 5);
  });

  test("«ejercicio completado» solo cuando están todos sus apartados, no al acabar el primero", async () => {
    const { admin } = adminDeMentira();
    const bien = comprobar("a) x = 5");
    const soloElA = await aplicarVeredicto({ admin, tenantId: "c", sessionId: "s", prep: { hoja, actividad: act, v: bien, apartadosHechos: new Set() } });
    assert.equal(soloElA.stepMap.allCompleted, false);
    const conElB = await aplicarVeredicto({ admin, tenantId: "c", sessionId: "s", prep: { hoja, actividad: act, v: comprobar("b) x = 4"), apartadosHechos: new Set([0]) } });
    assert.equal(conElB.stepMap.allCompleted, true);
  });

  test("REGRESIÓN: en un ejercicio comprobable, el [PASO_COMPLETADO] de la IA no cuenta; fuera de él, sí", async () => {
    const { pasosQueCuentan } = await import("../../server/lib/orchestrator/comprobadorEnElChat.js");
    assert.equal(pasosQueCuentan({ veredicto: { comprobable: true }, aplicado: null, pasosDeLaIA: 1 }), 0, "la IA dice paso hecho y el código no lo ha visto");
    assert.equal(pasosQueCuentan({ veredicto: { comprobable: true }, aplicado: { avance: 2 }, pasosDeLaIA: 0 }), 2);
    assert.equal(pasosQueCuentan({ veredicto: null, aplicado: null, pasosDeLaIA: 1 }), 1);
    const chat = (await import("node:fs")).readFileSync(new URL("../../server/lib/orchestrator/chatHandler.js", import.meta.url), "utf8");
    assert.match(chat, /pasosQueCuentan\(\{ veredicto, aplicado, pasosDeLaIA: run\.data\.stepsCompleted \}\)/);
  });

  test("REGRESIÓN (2/10): los pasos escritos SEGUIDOS en una línea se separan igual que en líneas", () => {
    const comoLineas = comprobar("a) 3x = 19 − 4\n3x = 15\nx = 5");
    for (const seguido of [
      "a) 3x + 4 = 19 → 3x = 15 → x = 5",
      "a) 3x=15→x=5",
      "a) 3x = 19 − 4 = 15 y luego x = 15 : 3 = 5",
      "a) 3x + 4 = 19 3x = 15 x = 5",
      "a) 3x=15, x=5",
    ]) {
      const v = comprobar(seguido);
      assert.equal(v.estado, "comprobado", seguido);
      assert.equal(v.todoHecho, true, seguido);
      assert.deepEqual(v.hitos.map((h) => h.estado), comoLineas.hitos.map((h) => h.estado), seguido);
    }
  });

  test("la cadena de iguales con un error dentro: se marca el trozo malo, no la cadena entera", () => {
    const v = comprobar("a) 3x = 19 + 4 = 23");
    assert.deepEqual(v.comprobacion.lineas.map((l) => l.texto), ["3x = 19 + 4", "3x = 23"]);
    assert.equal(v.comprobacion.primeraMal, 0);
    const mitad = comprobar("a) 3x = 19 − 4 = 16");
    assert.deepEqual(mitad.comprobacion.lineas.map((l) => l.equivalente), [true, false], "19 − 4 bien, el 16 es una cuenta mal");
  });

  test("en reducir, la cadena de iguales son pasos de la misma expresión", () => {
    const reducir = { clave: "reduce_con_parentesis", nombre: "Quita el paréntesis y reduce", respuestas: [
      { texto: "2(x − 4) + 2x = ___", solucion: "4x − 8", trampas: [] },
    ] };
    const actR = actividadesDeLaHoja({ temaId: TEMA, huecos: [reducir] })[0];
    const v = comprobarMensaje({ texto: "2(x − 4) + 2x = 2x − 8 + 2x = 4x − 8", actividad: actR });
    assert.equal(v.todoHecho, true);
    assert.deepEqual(v.hitos.map((h) => h.estado), ["hecho", "hecho"]);
  });

  test("la cadena de iguales FALSA se le señala (aunque acabe bien); la bien hecha, no", async () => {
    const { cadenaFalsa } = await import("../../server/lib/tutor/comprobador/lineasDelMensaje.js");
    assert.equal(cadenaFalsa("3 + 4 = 7 · 2 = 14"), true, "la cuenta seguida de Primaria");
    assert.equal(cadenaFalsa("3x = 19 − 4 = 16"), true);
    assert.equal(cadenaFalsa("3x = 19 − 4 = 15"), false);
    assert.equal(cadenaFalsa("x = 15 : 3 = 5"), false);
    assert.equal(cadenaFalsa("2(x − 4) + 2x = 2x − 8 + 2x = 4x − 8"), false);
    assert.equal(cadenaFalsa("2(x − 4) + 2x = 2x − 4 + 2x = 4x − 4"), true);
    assert.equal(cadenaFalsa("3x = 15"), false, "sin cadena no hay nada que señalar");
    const v = comprobar("a) 3x = 19 − 4 = 16\nx = 5");
    assert.equal(v.cadenaFalsa, "3x = 19 − 4 = 16");
    assert.match(instruccionesParaElTutor(v), /separe los pasos con flechas/);
    assert.doesNotMatch(instruccionesParaElTutor(comprobar("a) 3x = 19 − 4 = 15\nx = 5")), /flechas/);
  });
}
