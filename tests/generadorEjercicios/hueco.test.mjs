// LA IGUALDAD CON UN HUECO: las dos trampas de imprimirla.
//
// Las dos se descubrieron mirando un folio, no leyendo el código, y las dos
// son invisibles en cualquier test que compare valores:
//
//   1. Si el `___` cae DENTRO de un `$...$`, KaTeX no puede emparejar los
//      dólares (la plantilla ya ha convertido el `___` en un `<span>` antes)
//      y el apartado se imprime en crudo, con los dólares a la vista.
//   2. Sin un `\;` delante, el signo se pega al subrayado: `8+______`.
//
// Por eso este archivo comprueba la CADENA IMPRESA y no el resultado.
export async function run({ test, assert }) {
  const { conHueco } = await import(
    "../../server/lib/generadorEjercicios/generadores/hueco.js"
  );
  const { suma, resta, por, entre } = await import(
    "../../server/lib/generadorEjercicios/expresion.js"
  );

  const CASOS = [
    { operador: "+", arma: suma },
    { operador: "-", arma: resta },
    { operador: "·", arma: por },
    { operador: ":", arma: entre },
  ];
  // Los dos lados del hueco, y con el operando visible positivo y negativo.
  const POSICIONES = [true, false];
  const OPERANDOS = [[20, 7], [20, -7], [-20, 7], [-20, -7]];

  const todos = [];
  for (const { operador, arma } of CASOS) {
    for (const huecoDetras of POSICIONES) {
      for (const [izq, der] of OPERANDOS) {
        todos.push({
          operador,
          huecoDetras,
          izq,
          der,
          apartado: conHueco({
            izq,
            der,
            operador,
            total: 999,
            huecoDetras,
            arbol: arma(izq, der),
          }),
        });
      }
    }
  }

  test("el hueco NUNCA queda dentro de un par de dólares", () => {
    // La comprobación: partiendo por `$`, los trozos en posición impar son
    // los que van dentro de fórmula. El `___` no puede estar en ninguno.
    for (const { apartado, operador, huecoDetras } of todos) {
      const trozos = apartado.latex.split("$");
      assert.equal(
        trozos.length % 2,
        1,
        `dólares desparejados en "${apartado.latex}"`,
      );
      for (let i = 1; i < trozos.length; i += 2) {
        assert.equal(
          trozos[i].includes("___"),
          false,
          `hueco dentro de fórmula (${operador}, detrás=${huecoDetras}): "${apartado.latex}"`,
        );
      }
    }
  });

  test("hay aire entre el operador y el hueco, con los CUATRO operadores", () => {
    // El fallo original solo se vio con `+`, y la primera explicación que me
    // di —"`+` y `−` no llevan espacio en LaTeX, `\\cdot` y `:` sí"— era
    // falsa: el espacio se pierde en el borde entre elementos HTML, así que
    // le pasa a los cuatro. Este test es lo que impide volver a esa versión.
    for (const { apartado, operador, huecoDetras } of todos) {
      const [antes, despues] = apartado.latex.split("___");
      const pegado = huecoDetras ? antes : despues;
      assert.ok(
        pegado.includes("\\;"),
        `sin aire junto al hueco (${operador}, detrás=${huecoDetras}): "${apartado.latex}"`,
      );
    }
  });

  test("el operador lleva aire por los dos lados, con el hueco DELANTE Y DETRÁS", () => {
    // Este test se escribió dos veces y la primera se quedó a medias, que es
    // por lo que está contado aquí.
    //
    // El folio imprimió `___ ·4 = -20`, con el punto pegado al 4, y se
    // arregló solo esa posición del hueco. La impresión siguiente trajo el
    // simétrico: `4· ___ = -36`, el mismo punto pegado al mismo 4 por el otro
    // lado. Un operador binario al que le falta un operando —porque abre o
    // porque cierra la fórmula— pierde el espacio de los DOS lados, así que
    // las dos posiciones necesitan los dos `\;`.
    for (const { apartado, operador, huecoDetras } of todos) {
      const [antes, despues] = apartado.latex.split("___");
      const junto = huecoDetras ? antes : despues;
      const trozos = junto.split("\\;");
      assert.ok(
        trozos.length >= 3,
        `el operador ${operador} (detrás=${huecoDetras}) no tiene aire a los dos lados: `
          + `"${apartado.latex}"`,
      );
    }
  });

  test("un operando negativo a la derecha del operador va entre paréntesis", () => {
    // `___ - -11` no es notación de libro de texto. A la izquierda, en
    // cambio, el negativo va desnudo: `-20 + ___`.
    for (const { apartado, huecoDetras, izq, der } of todos) {
      const visible = huecoDetras ? izq : der;
      if (visible >= 0) continue;
      if (huecoDetras) {
        assert.ok(
          apartado.latex.includes(`$${visible}`),
          `el operando de la izquierda no debería llevar paréntesis: "${apartado.latex}"`,
        );
      } else {
        assert.ok(
          apartado.latex.includes(`(${visible})`),
          `falta el paréntesis del operando de la derecha: "${apartado.latex}"`,
        );
      }
    }
  });

  test("la solución es el operando TAPADO, no el total", () => {
    for (const { apartado, huecoDetras, izq, der } of todos) {
      assert.equal(apartado.solucion, huecoDetras ? der : izq, `"${apartado.texto}"`);
      assert.notEqual(apartado.solucion, 999, `la solución es el total en "${apartado.texto}"`);
    }
  });

  test("el texto plano y el LaTeX dicen lo mismo", () => {
    // Si divergieran, un test que lee el texto daría por bueno un folio que
    // se imprime distinto. Se comparan los números y el orden, que es lo que
    // puede desincronizarse.
    for (const { apartado } of todos) {
      // SIN LOS ESPACIOS ANTES DE LEER LOS NÚMEROS, y no es un detalle del
      // test: en texto plano el operador va separado (`___ - 7`) y en LaTeX
      // no (`___-7`), así que una expresión regular ingenua lee `7` en uno y
      // `-7` en el otro y declara una divergencia que no existe. Es el mismo
      // guion haciendo dos papeles — exactamente la confusión del tema.
      const numeros = (s) => (s.replace(/\s+/g, "").match(/-?\d+/g) || []).join(",");
      assert.equal(
        numeros(apartado.texto),
        numeros(apartado.latex.replace(/\\;/g, "")),
        `"${apartado.texto}" frente a "${apartado.latex}"`,
      );
      assert.ok(apartado.texto.includes("___"), `el texto no lleva hueco: "${apartado.texto}"`);
    }
  });

  test("un operador desconocido revienta en vez de imprimir algo raro", () => {
    assert.throws(
      () => conHueco({ izq: 1, der: 2, operador: "^", total: 1, huecoDetras: true, arbol: suma(1, 2) }),
      /operador sin unión conocida/,
    );
  });
}
