// LA EXPRESIÓN COMO ÁRBOL: evaluación exacta e impresión.
//
// Es la pieza de la que cuelga todo el generador de hojas, así que se prueba
// más duro que nada. Lo que se vigila, por orden de lo que costaría un fallo:
//
//   1. `-3^2` frente a `(-3)^2`. El catálogo (concepto 11) pone esos dos
//      ejercicios uno al lado del otro PORQUE no son lo mismo: −9 y 9. Si la
//      impresión los confundiera, saldría una hoja con una solución que no
//      corresponde al enunciado, y nadie lo vería hasta que un alumno lo
//      corrigiera en clase.
//   2. La división exacta. Un cociente decimal convierte un ejercicio de
//      enteros en uno de decimales, que el alumno de 1.º no ha dado.
//   3. Que los paréntesis impresos digan lo que dice el árbol. Un paréntesis
//      de más o de menos cambia el resultado.
export async function run({ test, assert }) {
  const {
    num, neg, op, suma, resta, por, entre, pot, cadena,
    evaluar, render, enunciado, TOPE_ABSOLUTO,
  } = await import("../../server/lib/generadorEjercicios/expresion.js");

  const val = (a) => evaluar(a).valor;

  // ── EL CASO QUE JUSTIFICA TODO EL DISEÑO ─────────────────────────────

  test("EL PUNTO DE TODO: -3^2 y (-3)^2 son ejercicios DISTINTOS", () => {
    const menosTresAlCuadrado = neg(pot(3, 2));   // -3^2  = -9
    const parentesisAlCuadrado = pot(-3, 2);      // (-3)^2 = 9

    assert.equal(val(menosTresAlCuadrado), -9);
    assert.equal(val(parentesisAlCuadrado), 9);

    // Y se imprimen distinto, que es la otra mitad: si los dos salieran
    // como "-(3^2)" el ejercicio del catálogo perdería su único sentido.
    assert.equal(render(menosTresAlCuadrado), "-3^2");
    assert.equal(render(parentesisAlCuadrado), "(-3)^2");
  });

  test("y por eso no se puede guardar el ejercicio como texto", () => {
    // La cadena "-3^2" es ambigua para quien la lea; el árbol no lo es.
    // Este test no comprueba código: fija la decisión de arquitectura.
    assert.notEqual(val(neg(pot(3, 2))), val(pot(-3, 2)));
  });

  // ── Evaluación ───────────────────────────────────────────────────────

  test("sumas y restas de enteros, con los cuatro casos de signos", () => {
    assert.equal(val(suma(-6, -1)), -7);
    assert.equal(val(suma(-12, 5)), -7);
    assert.equal(val(resta(-19, -21)), 2);
    assert.equal(val(resta(40, -15)), 55);
  });

  test("una cadena sin paréntesis se opera de izquierda a derecha", () => {
    // -6 + 7 - 4 - 2 + 1 - 9 = -13 (arquetipo real del catálogo)
    assert.equal(val(cadena([-6, "+", 7, "-", 4, "-", 2, "+", 1, "-", 9])), -13);
  });

  test("la resta NO es asociativa, y el árbol lo respeta", () => {
    // 8 - (3 - 1) = 6, pero (8 - 3) - 1 = 4. Si el árbol se aplanara, el
    // generador y el corrector darían resultados distintos.
    assert.equal(val(resta(8, resta(3, 1))), 6);
    assert.equal(val(resta(resta(8, 3), 1)), 4);
  });

  test("la regla de los signos en producto y cociente", () => {
    assert.equal(val(por(-3, 5)), -15);
    assert.equal(val(por(-2, -3)), 6);
    assert.equal(val(entre(-35, -5)), 7);
    assert.equal(val(entre(8, -2)), -4);
  });

  test("EL PUNTO DE TODO: una división no exacta se RECHAZA, no se redondea", () => {
    const r = evaluar(entre(7, 2));
    assert.equal(r.valor, null, "3,5 no es un ejercicio de enteros");
    assert.equal(r.motivo, "division_no_exacta");
  });

  test("dividir por cero se rechaza con su propio motivo", () => {
    assert.equal(evaluar(entre(5, 0)).motivo, "division_por_cero");
  });

  test("el rechazo NO es una excepción: es el camino normal del generador", () => {
    // Se descarta un candidato y se prueba otro, miles de veces. Si esto
    // lanzara, cada intento fallido costaría un try/catch en el generador.
    assert.doesNotThrow(() => evaluar(entre(7, 2)));
    assert.doesNotThrow(() => evaluar(entre(1, 0)));
  });

  test("pero un árbol mal construido SÍ lanza: eso es un bug, no un rechazo", () => {
    assert.throws(() => num(1.5), /enteros/);
    assert.throws(() => op("%", 1, 2), /operador desconocido/);
    assert.throws(() => suma("dos", 3), /no es una expresión/);
  });

  // ── Potencias ────────────────────────────────────────────────────────

  test("el exponente par o impar decide el signo", () => {
    assert.equal(val(pot(-2, 3)), -8);
    assert.equal(val(pot(-2, 4)), 16);
  });

  test("(-1)^2375 se resuelve por paridad, no calculándolo", () => {
    // Es un ejercicio real del catálogo: se pone justamente para ver si el
    // alumno aplica la regla o intenta multiplicar. El generador tampoco lo
    // multiplica.
    assert.equal(val(pot(-1, 2375)), -1);
    assert.equal(val(pot(-1, 2376)), 1);
    assert.equal(val(pot(1, 999999)), 1);
  });

  test("un exponente grande con cualquier otra base se rechaza", () => {
    assert.equal(evaluar(pot(2, 40)).motivo, "exponente_demasiado_grande");
    assert.equal(evaluar(pot(-3, 20)).motivo, "exponente_demasiado_grande");
  });

  test("un exponente negativo se rechaza: no es de 1.º ESO", () => {
    assert.equal(evaluar(pot(2, -1)).motivo, "exponente_negativo");
  });

  // ── El tope, que es pedagógico y no técnico ──────────────────────────

  test("EL PUNTO DE TODO: sin calculadora, los números tienen que caber en la cabeza", () => {
    // Jorge, 17/09: "en 1 eso no dejan calculadora". Un resultado de seis
    // cifras no es un ejercicio más difícil: es un ejercicio imposible.
    assert.equal(evaluar(por(999, 999)).motivo, "fuera_de_rango");
    assert.equal(evaluar(pot(10, 6)).motivo, "fuera_de_rango");
    assert.ok(TOPE_ABSOLUTO <= 10000, "el tope tiene que seguir siendo pequeño");
  });

  test("el tope se puede apretar por ejercicio, para los de nivel 1", () => {
    assert.equal(evaluar(suma(60, 40), { tope: 50 }).motivo, "fuera_de_rango");
    assert.equal(evaluar(suma(6, 4), { tope: 50 }).valor, 10);
  });

  test("también se acota lo que hay DENTRO, no solo el resultado", () => {
    // 5000 · 4 : 4 da 5000, dentro de tope, pero por el camino pasa por
    // 20000. Si solo se mirara el final, saldría un ejercicio con un
    // producto de cinco cifras que hay que hacer a mano.
    assert.equal(evaluar(entre(por(5000, 4), 4)).motivo, "fuera_de_rango");
  });

  // ── Impresión: los paréntesis ────────────────────────────────────────

  test("un negativo a la derecha va entre paréntesis (notación de libro)", () => {
    assert.equal(render(suma(-6, -1)), "-6 + (-1)");
    assert.equal(render(resta(-19, -21)), "-19 - (-21)");
  });

  test("con parentesisSiempre sale la escritura de las baterías de signos", () => {
    // El catálogo escribe `(-19) - (-21)` y `(-3) · 5`: en esas baterías lo
    // que se practica es ver el signo del número separado del de la
    // operación, y por eso se envuelve también el de la izquierda. En las
    // sumas NO lo hace (`-6 + (-1)`), así que no puede ser una regla fija.
    assert.equal(render(resta(-19, -21), { parentesisSiempre: true }), "(-19) - (-21)");
    assert.equal(render(por(-3, 5), { parentesisSiempre: true }), "(-3) · 5");
    assert.equal(render(entre(-35, -5), { parentesisSiempre: true }), "(-35) : (-5)");
  });

  test("pero se puede pedir la otra escritura, que el catálogo mezcla a propósito", () => {
    // El arquetipo dice: "Mezcla las dos escrituras: con paréntesis
    // explícito y sin él" (-6 + (-1) frente a -4 - 6).
    assert.equal(render(suma(-6, -1), { negativosEntreParentesis: false }), "-6 + -1");
    assert.equal(render(resta(-4, 6)), "-4 - 6", "sin negativo a la derecha no hay paréntesis");
  });

  test("los paréntesis obligatorios salen solos", () => {
    assert.equal(render(resta(-7, resta(8, 10))), "-7 - (8 - 10)");
    assert.equal(render(por(suma(2, 3), 4)), "(2 + 3) · 4");
    assert.equal(render(entre(-18, por(-3, -2))), "-18 : (-3 · (-2))");
  });

  test("y NO salen cuando no hacen falta: una hoja no se llena de paréntesis", () => {
    assert.equal(render(suma(suma(2, 3), 4)), "2 + 3 + 4");
    assert.equal(render(resta(resta(8, 3), 1)), "8 - 3 - 1");
    assert.equal(render(suma(por(2, 3), 4)), "2 · 3 + 4");
  });

  test("el menos unario: -(-3 + 10) + 7, como en el catálogo", () => {
    assert.equal(render(suma(neg(suma(-3, 10)), 7)), "-(-3 + 10) + 7");
  });

  test("el opuesto del opuesto no imprime dos menos seguidos", () => {
    assert.equal(render(neg(neg(2))), "-(-2)");
    assert.equal(render(neg(num(-3))), "-(-3)");
    assert.equal(val(neg(neg(2))), 2);
  });

  test("corchetes anidados del catálogo: el árbol y el texto cuadran", () => {
    // 6 - (5 - 3) - (7 - (-1 - 4)) = 6 - 2 - 12 = -8
    const e = resta(resta(6, resta(5, 3)), resta(7, resta(-1, 4)));
    assert.equal(render(e), "6 - (5 - 3) - (7 - (-1 - 4))");
    assert.equal(val(e), -8);
  });

  test("una combinada con dos niveles: 2 · (8 - 4 · (10 - 6) - (-3 - 2))", () => {
    const e = por(2, resta(resta(8, por(4, resta(10, 6))), resta(-3, 2)));
    assert.equal(val(e), 2 * (8 - 4 * 4 - (-5)));
    assert.equal(val(e), -6);
    assert.equal(render(e), "2 · (8 - 4 · (10 - 6) - (-3 - 2))");
  });

  test("REGRESIÓN: lo que se imprime vale lo que dice el árbol", () => {
    // El barrido que de verdad protege: para un puñado de árboles, el texto
    // impreso, leído por una persona, tiene que dar el mismo número. Se
    // comprueba con eval() de JavaScript traduciendo la notación española,
    // que es un segundo evaluador independiente del nuestro.
    const casos = [
      suma(-6, -1), resta(-19, -21), por(-3, 5), entre(-35, -5),
      resta(-7, resta(8, 10)), suma(neg(suma(-3, 10)), 7),
      cadena([-6, "+", 7, "-", 4, "-", 2, "+", 1, "-", 9]),
      resta(resta(6, resta(5, 3)), resta(7, resta(-1, 4))),
      por(2, resta(resta(8, por(4, resta(10, 6))), resta(-3, 2))),
      pot(-3, 2), neg(pot(3, 2)), suma(por(2, 3), 4), entre(por(12, 3), -4),
    ];
    for (const arbol of casos) {
      const texto = render(arbol);
      // JAVASCRIPT PROHÍBE `-3**2`: da error de sintaxis y exige paréntesis
      // "para desambiguar la precedencia". Es un dato curioso y a favor del
      // diseño — el lenguaje se niega justamente donde la notación
      // matemática sí tiene una convención (`-3^2 = -9`). Para el cruce se
      // le pone el paréntesis que JS pide, que no cambia el valor.
      const enJs = texto
        .replace(/·/g, "*").replace(/:/g, "/").replace(/\^/g, "**")
        .replace(/^-(\d+)\*\*(\d+)/, "-($1**$2)");
      // eslint-disable-next-line no-eval
      const segunJs = eval(enJs);
      assert.equal(
        segunJs, val(arbol),
        `"${texto}" se lee como ${segunJs} y nuestro evaluador dice ${val(arbol)}`
      );
    }
  });

  test("el enunciado lleva el hueco donde escribe el alumno", () => {
    assert.equal(enunciado(suma(-6, -1)), "-6 + (-1) = ___");
  });
}
