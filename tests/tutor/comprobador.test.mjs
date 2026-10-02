// EL COMPROBADOR: con ejercicios de verdad de 1.º ESO (los del molde de
// Álgebra), lo que escribe un alumno, bien y mal.
export async function run({ test, assert }) {
  const { normaliza } = await import("../../server/lib/tutor/comprobador/notacionDelAlumno.js");
  const { comprobarLineas } = await import("../../server/lib/tutor/comprobador/lineas.js");
  const { hitosDelEnvio } = await import("../../server/lib/tutor/comprobador/hitos.js");
  const { metodoDe } = await import("../../server/lib/tutor/metodos/catalogo.js");

  const ALGEBRA = "c0000000-0000-4000-8000-000000000005";
  const metodo = (clave) => metodoDe({ tema: ALGEBRA, clave });
  const ecuacion = (enunciado, lineas, clave, trampas = []) => {
    const comprobacion = comprobarLineas({ referencia: { tipo: "ecuacion", ecuacion: enunciado }, lineas });
    return { comprobacion, ...hitosDelEnvio({ metodo: metodo(clave), comprobacion, tipo: "ecuacion", trampas }) };
  };
  const expresion = (enunciado, lineas, clave) => {
    const comprobacion = comprobarLineas({ referencia: { tipo: "expresion", expresion: enunciado }, lineas });
    return { comprobacion, ...hitosDelEnvio({ metodo: metodo(clave), comprobacion, tipo: "expresion" }) };
  };
  const estados = (r) => r.hitos.map((h) => h.estado);

  test("notación del alumno: menos tipográfico, 2x, 3(…), dos puntos, coma decimal, x²", () => {
    assert.equal(normaliza("2x − 3 = 7"), "2*x-3=7");
    assert.equal(normaliza("3(x + 2) = 12"), "3*(x+2)=12");
    assert.equal(normaliza("x : 4 = 5"), "x/4=5");
    assert.equal(normaliza("2,5x = 10"), "2.5*x=10");
    assert.equal(normaliza("x² + 1"), "x^2+1");
    assert.equal(normaliza("4·(−1) − 8"), "4*(-1)-8");
    assert.throws(() => normaliza("x = ¿5?"));
    assert.throws(() => normaliza("   "));
  });

  test("REGRESIÓN (el fallo del signo): el error arrastrado se localiza en la línea donde empieza", () => {
    // 3x + 4 = 19 → x = 5. Cambia el signo al pasar el 4 y sigue bien desde ahí.
    const r = ecuacion("3*x + 4 = 19", ["3x = 19 + 4", "3x = 23", "x = 23/3"], "ecuacion_dos_pasos",
      [{ error: 5, solucion: 23 / 3 }]);
    assert.equal(r.comprobacion.primeraMal, 0, "la primera línea es la mala, no la última");
    assert.deepEqual(r.comprobacion.lineas.map((l) => l.equivalente), [false, false, false]);
    assert.deepEqual(estados(r), ["mal", "pendiente"]);
    assert.equal(r.hitos[0].linea, 0);
    assert.deepEqual(r.errorProbable, { error: 5, motivo: "coincide con la respuesta-trampa" });
  });

  test("bien hecho, paso a paso o de golpe: todos los hitos hechos", () => {
    assert.deepEqual(estados(ecuacion("3*x + 4 = 19", ["3x = 19 − 4", "3x = 15", "x = 5"], "ecuacion_dos_pasos")), ["hecho", "hecho"]);
    const deGolpe = ecuacion("3*x + 4 = 19", ["x = 5"], "ecuacion_dos_pasos");
    assert.deepEqual(estados(deGolpe), ["hecho", "hecho"]);
    assert.equal(deGolpe.comprobacion.primeraMal, null);
  });

  test("el método de la balanza vale igual que la transposición", () => {
    const r = ecuacion("x + 6 = 12", ["x + 6 − 6 = 12 − 6", "x = 6"], "ecuacion_suma_resta");
    assert.deepEqual(estados(r), ["hecho"]);
  });

  test("bien hasta la mitad: el primer hito hecho y el segundo mal", () => {
    const r = ecuacion("3*x + 4 = 19", ["3x = 15", "x = 15 − 3"], "ecuacion_dos_pasos");
    assert.equal(r.comprobacion.primeraMal, 1);
    assert.deepEqual(estados(r), ["hecho", "mal"]);
  });

  test("con paréntesis: multiplicar solo el primer término es el error 8 y para la lista en el primer hito", () => {
    const mal = ecuacion("2*(x + 3) = 14", ["2x + 3 = 14", "2x = 11"], "ecuacion_con_parentesis",
      [{ error: 8, solucion: 5.5 }]);
    assert.deepEqual(estados(mal), ["mal", "pendiente", "pendiente"]);
    assert.equal(mal.errorProbable.error, 8);
    const bien = ecuacion("2*(x + 3) = 14", ["2x + 6 = 14", "2x = 14 − 6", "2x = 8", "x = 4"], "ecuacion_con_parentesis");
    assert.deepEqual(estados(bien), ["hecho", "hecho", "hecho"]);
  });

  test("x en los dos lados: agrupar, reducir y despejar", () => {
    const r = ecuacion("5*x - 3 = 2*x + 9", ["5x − 2x = 9 + 3", "3x = 12", "x = 4"], "ecuacion_x_dos_lados");
    assert.deepEqual(estados(r), ["hecho", "hecho", "hecho"]);
    const aMedias = ecuacion("5*x - 3 = 2*x + 9", ["5x − 2x − 3 = 9"], "ecuacion_x_dos_lados");
    assert.deepEqual(estados(aMedias), ["pendiente", "pendiente", "pendiente"], "aún le quedan números con las x");
  });

  test("una línea que no se entiende sale como dudosa, nunca como bien ni mal", () => {
    const r = ecuacion("3*x + 4 = 19", ["3x = 15", "x = ¿5?"], "ecuacion_dos_pasos");
    assert.deepEqual(r.dudosas, [1]);
    assert.equal(r.comprobacion.lineas[1].equivalente, null);
    assert.equal(r.comprobacion.primeraMal, null);
    assert.deepEqual(estados(r), ["hecho", "pendiente"]);
  });

  test("reducir con paréntesis: quitarlo y juntar; multiplicar solo el primero es mal", () => {
    assert.deepEqual(estados(expresion("2*(x - 4) + 2*x", ["2x − 8 + 2x", "4x − 8"], "reduce_con_parentesis")), ["hecho", "hecho"]);
    const mal = expresion("2*(x - 4) + 2*x", ["2x − 4 + 2x"], "reduce_con_parentesis");
    assert.equal(mal.comprobacion.primeraMal, 0);
    assert.deepEqual(estados(mal), ["mal", "pendiente"]);
  });

  test("valor numérico: sustituir y calcular", () => {
    const r = expresion("4*(-1) - 8", ["4·(−1) − 8", "−4 − 8", "−12"], "valor_numerico");
    assert.deepEqual(estados(r), ["hecho", "hecho"]);
    const pegado = expresion("4*(-1) - 8", ["−41 − 8"], "valor_numerico");
    assert.deepEqual(estados(pegado), ["mal", "pendiente"]);
  });

  test("forma bien y número mal: lo más probable es una cuenta (error 10), no un error de método", () => {
    const r = ecuacion("3*x + 4 = 19", ["3x = 15", "x = 6"], "ecuacion_dos_pasos");
    assert.deepEqual(r.errorProbable, { error: null, motivo: "forma bien, cuenta mal" });
  });

  test("con 40 hojas de verdad del generador: la solución da todos los hitos y cada trampa se reconoce", async () => {
    const { ALGEBRA_1ESO } = await import("../../server/lib/generadorEjercicios/temas/algebra1eso.js");
    const { crearAzar } = await import("../../server/lib/generadorEjercicios/aleatorio.js");
    const { trampasDelApartado } = await import("../../server/lib/generadorEjercicios/errores/trampasDelApartado.js");
    let probados = 0;
    let trampasProbadas = 0;
    for (const b of Object.values(ALGEBRA_1ESO.baterias).flat().filter((x) => x.clave.startsWith("ecuacion_"))) {
      for (let s = 0; s < 40; s += 1) {
        for (const a of b.generador(crearAzar(`comprobador-${b.clave}-${s}`), { cuantos: b.minimo }).apartados) {
          const enunciado = normaliza(a.texto.split(" → ")[0]);
          const trampas = trampasDelApartado(b.clave, a).map((t) => ({ error: t.error, solucion: Number(t.respuesta) }));
          const bien = ecuacion(enunciado, [`x = ${a.solucion}`], b.clave, trampas);
          assert.equal(bien.comprobacion.primeraMal, null, `${a.texto}: x = ${a.solucion} tiene que estar bien`);
          assert.ok(bien.hitos.every((h) => h.estado === "hecho"), a.texto);
          probados += 1;
          for (const t of trampas) {
            const mal = ecuacion(enunciado, [`x = ${t.solucion}`], b.clave, trampas);
            assert.equal(mal.comprobacion.primeraMal, 0, `${a.texto}: x = ${t.solucion} (error ${t.error}) tiene que estar mal`);
            assert.equal(mal.errorProbable?.error, t.error, `${a.texto}: x = ${t.solucion} es el error ${t.error}`);
            trampasProbadas += 1;
          }
        }
      }
    }
    assert.ok(probados > 500 && trampasProbadas > 200, `${probados} ecuaciones, ${trampasProbadas} trampas`);
  });
}
