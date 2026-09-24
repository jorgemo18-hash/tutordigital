import fs from "node:fs";

// LAS RESPUESTAS-TRAMPA (server/lib/generadorEjercicios/errores/): qué
// escribiría un alumno con cada error predecible del catálogo de Jorge.
export async function run({ test, assert }) {
  const { evaluarConError } = await import("../../server/lib/generadorEjercicios/errores/evaluarConError.js");
  const { trampasDelApartado, trampasDeHueco, respuestasDe } = await import("../../server/lib/generadorEjercicios/errores/trampasDelApartado.js");
  const { ERRORES_PREDECIBLES } = await import("../../server/lib/generadorEjercicios/errores/erroresPredecibles.js");
  const { num, neg, suma, resta, por, entre, op } = await import("../../server/lib/generadorEjercicios/expresion.js");
  const { conHueco } = await import("../../server/lib/generadorEjercicios/generadores/hueco.js");
  const { hojaDelPanel, catalogoDelPanel } = await import("../../server/lib/generadorEjercicios/hojaDelPanel.js");
  const { GuardarSchema } = await import("../../server/routes/v1/hojas/rutasDeHojasGuardadas.js");

  test("LOS EJEMPLOS DEL CATÁLOGO DE JORGE (migración 120) salen tal cual", () => {
    assert.equal(evaluarConError(resta(8, -5), 1), 3, "1: 8 - (-5) = 8 - 5 = 3");
    assert.equal(evaluarConError(suma(-8, 5), 2), -13, "2: -8 + 5 = -13");
    assert.equal(evaluarConError(suma(-9, 4), 3), 5, "3: -9 + 4 = +5");
    assert.equal(evaluarConError(por(-4, -3), 5), -12, "5: (-4)·(-3) = -12");
    assert.equal(evaluarConError(resta(5, -3), 6), 2, "6: 5 - (-3) = 2");
    assert.equal(evaluarConError(resta(8, suma(-3, 5)), 7), 10, "7: 8 - (-3 + 5) = 8 - 3 + 5");
    assert.equal(evaluarConError(suma(3, por(4, -2)), 8), -14, "8: 3 + 4·(-2) = 7·(-2)");
    assert.equal(evaluarConError(suma(-7, -2), 10), 9, "10: -7 + (-2) = +9");
  });

  test("errores 1 y 10 dan respuestas DISTINTAS en -7 + (-2) (por eso son dos errores, migración 120)", () => {
    assert.equal(evaluarConError(suma(-7, -2), 1), -5);
    assert.equal(evaluarConError(suma(-7, -2), 10), 9);
  });

  test("un error de concepto es SISTEMÁTICO: se aplica en toda la expresión", () => {
    // -3 + 5 + (-7): con el 2, -3 + 5 = +8 y 8 + (-7) = +15.
    assert.equal(evaluarConError(suma(suma(-3, 5), -7), 2), 15);
    // -(-3 + 10) con el 7: se abre sin cambiar signos, -3 + 10.
    assert.equal(evaluarConError(neg(suma(-3, 10)), 7), 7);
  });

  test("SIN UN NEGATIVO A LA VISTA no hay error de enteros: 50 - 14 no da trampa del 2 ni del 3", () => {
    const t = trampasDelApartado("resta_con_parentesis", { arbol: resta(50, 14), solucion: 36 });
    assert.deepEqual(t.filter((x) => x.error === 2 || x.error === 3), []);
  });

  test("la jerarquía respeta los paréntesis que se VEN: 10 - (-3)·7 → (10 + 3)·7 = 91", () => {
    assert.equal(evaluarConError(resta(10, por(-3, 7)), 8), 91);
    assert.equal(evaluarConError(por(3, resta(6, 9)), 8), -9, "un grupo entre paréntesis sigue siendo un grupo");
  });

  test("una división que con el error ya no es exacta no deja trampa (null, no un decimal)", () => {
    assert.equal(evaluarConError(entre(suma(3, por(4, -2)), 5), 8), null, "(3+4)·(-2)... 7·(-2) = -14, -14 : 5 no es exacta");
  });

  test("HUECO: lo que escribiría el alumno para que su cuenta le cuadre", () => {
    const a = conHueco({ izq: 21, der: -4, operador: "+", total: 17, huecoDetras: false, arbol: suma(21, -4) });
    const t = trampasDeHueco(a);
    // Con el 1, lee (-4) como 4: ___ + 4 = 17 → 13.
    assert.deepEqual(t.find((x) => x.error === 1), { error: 1, respuesta: "13" });
    assert.equal(a.solucion, 21);
  });

  test("LOS QUE NO SON EXPRESIONES: situación (9), comparar y ordenar (4), valor absoluto (11), opuesto (12)", () => {
    assert.deepEqual(trampasDelApartado("asocia_entero_situacion", { solucion: -6 }), [{ error: 9, respuesta: "6" }]);
    assert.deepEqual(trampasDelApartado("compara_enteros", { solucion: ">", pareja: [-3, -8] }), [{ error: 4, respuesta: "<" }]);
    assert.deepEqual(trampasDelApartado("ordena_lista", { solucion: [-8, -3, 0, 2], lista: [2, -3, 0, -8] }),
      [{ error: 4, respuesta: "-3 < -8 < 0 < 2" }]);
    assert.deepEqual(trampasDelApartado("valor_absoluto", { solucion: 7, numero: -7 }), [{ error: 11, respuesta: "-7" }]);
    assert.deepEqual(trampasDelApartado("valor_absoluto", { solucion: 7, numero: 7 }), [], "|7| no detecta nada");
    assert.deepEqual(trampasDelApartado("escribe_opuesto", { solucion: 6, numero: -6 }), [{ error: 12, respuesta: "-6" }]);
    assert.deepEqual(trampasDelApartado("encadenados_opuesto_absoluto", { solucion: -10, numero: -10, pasos: ["abs", "op"] }),
      [{ error: 11, respuesta: "10" }, { error: 12, respuesta: "10" }]);
  });

  test("el ejemplo resuelto no lleva trampas (el alumno no lo contesta)", () => {
    const r = respuestasDe({ clave: "suma_distinto_signo", apartados: [{ resuelto: true, arbol: suma(-8, 5), solucion: -3 }, { arbol: suma(-8, 5), solucion: -3 }] });
    assert.deepEqual(r[0], { solucion: "-3", ejemplo: true, trampas: [] });
    assert.ok(r[1].trampas.some((x) => x.error === 2 && x.respuesta === "-13"));
  });

  test("LOS 13 ERRORES son los predecibles de la migración 120, con su id y su orden", () => {
    const sql = fs.readFileSync(new URL("../../supabase/migrations/120_semilla_enteros_1eso.sql", import.meta.url), "utf8");
    assert.equal(ERRORES_PREDECIBLES.length, 13);
    for (const e of ERRORES_PREDECIBLES) {
      const fila = sql.split(`('${e.id}'`)[1]?.split(/\n\s*\(|\n\s*--/)[0] || "";
      assert.match(fila, new RegExp(`'${e.categoria}', true,`), `error ${e.numero}: categoría y predecible`);
      assert.match(fila, new RegExp(`, ${e.numero}\\)`), `error ${e.numero}: orden`);
    }
  });

  test("EN LA HOJA DEL PANEL: cada hueco lleva sus respuestas, una por apartado, y NADA de eso va al folio", () => {
    const tema = catalogoDelPanel().temas[0];
    for (const o of tema.objetivos) {
      const r = hojaDelPanel({ temaId: tema.id, objetivo: o.numero, intensidad: "refuerzo", semilla: "t1", actividades: 8 });
      r.huecos.forEach((h, i) => {
        assert.equal(h.respuestas.length, (r.hoja.actividades[i].apartados || []).length, `${h.clave}: una respuesta por apartado`);
      });
      const folio = JSON.stringify(r.hoja);
      assert.equal(/trampas|"solucion"|respuestas/.test(folio), false, "la hoja impresa no lleva soluciones ni trampas");
      assert.ok(GuardarSchema.safeParse({ hoja: r.hoja, huecos: r.huecos, parametros: { temaId: tema.id, objetivo: o.numero, intensidad: "refuerzo" } }).success,
        "y se puede guardar tal cual (cabe en el límite)");
    }
  });

  test("hay trampas donde tiene que haberlas: una hoja de sumas y restas detecta los errores 2 y 3", () => {
    const tema = catalogoDelPanel().temas[0];
    const r = hojaDelPanel({ temaId: tema.id, objetivo: 3, intensidad: "refuerzo", semilla: "t2", actividades: 8 });
    const errores = new Set(r.huecos.flatMap((h) => h.respuestas.flatMap((x) => x.trampas.map((t) => t.error))));
    assert.ok(errores.has(2) && errores.has(3), [...errores].join(","));
    void num; void op;
  });
}
