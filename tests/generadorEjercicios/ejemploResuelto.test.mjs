// UN APARTADO RESUELTO EN CADA ACTIVIDAD, y su explicación.
//
// Jorge, el 17/9: *"habría que hacer un ejemplo (siempre) de cada ejercicio,
// porque un ejemplo global no sirve para algún ejercicio"*.
//
// El test que de verdad importa de este archivo es el tercero: que el número
// que dice la explicación SEA la solución del apartado. Una explicación que
// razona bien y da otro número es peor que no poner explicación, porque el
// alumno la sigue paso a paso y llega a lo que el folio dice que está mal.
export async function run({ test, assert }) {
  const { conEjemploResuelto, comoResuelto, SIN_EJEMPLO } = await import(
    "../../server/lib/generadorEjercicios/ejemploResuelto.js"
  );
  const { crearAzar } = await import("../../server/lib/generadorEjercicios/aleatorio.js");
  const { aActividadDeHoja } = await import("../../server/lib/generadorEjercicios/ejercicio.js");
  const sumaResta = await import("../../server/lib/generadorEjercicios/generadores/sumaResta.js");
  const producto = await import("../../server/lib/generadorEjercicios/generadores/producto.js");
  const potencias = await import("../../server/lib/generadorEjercicios/generadores/potencias.js");

  const GENERADORES = [
    ...Object.values(sumaResta),
    ...Object.values(producto),
    ...Object.values(potencias),
  ];
  const SEMILLAS = ["a", "b", "c", "d", 1, 2, 42, 7777];

  const conEjemplos = (cuantos = 4) =>
    GENERADORES.flatMap((g) => SEMILLAS.map((s) => conEjemploResuelto(g, crearAzar(s), { cuantos })));

  test("`cuantos` es obligatorio: el tamaño lo decide el montador, no esta función", () => {
    // Jorge: *"depende, si lo lleva muy mal bastantes ejercicios, si solo
    // falla a veces menos"*. Un valor por defecto aquí sería un tamaño
    // decidido en el sitio equivocado.
    assert.throws(
      () => conEjemploResuelto(sumaResta.sumaMismoSigno, crearAzar("x"), {}),
      /necesita `cuantos`/,
    );
  });

  test("EL EJEMPLO ES UN APARTADO DE MÁS, no uno de los de práctica", () => {
    // Si se gastara uno de los que había, las baterías que garantizan las
    // cuatro combinaciones de signos se quedarían con tres: dejarían de
    // diagnosticar. Se piden `cuantos + 1` y el extra es el ejemplo.
    for (const ej of conEjemplos(4)) {
      if (SIN_EJEMPLO.has(ej.clave)) continue;
      const practica = ej.apartados.filter((a) => !a.resuelto);
      assert.equal(practica.length, 4, `${ej.clave}: ${practica.length} de práctica en vez de 4`);
    }
  });

  test("hay exactamente UN resuelto y va PRIMERO", () => {
    // Un ejemplo después de los ejercicios es una solución, no un ejemplo.
    for (const ej of conEjemplos()) {
      if (SIN_EJEMPLO.has(ej.clave)) continue;
      const resueltos = ej.apartados.filter((a) => a.resuelto);
      assert.equal(resueltos.length, 1, `${ej.clave}: ${resueltos.length} resueltos`);
      assert.equal(ej.apartados[0].resuelto, true, `${ej.clave}: el ejemplo no va primero`);
    }
  });

  test("EL NÚMERO DE LA EXPLICACIÓN ES LA SOLUCIÓN DEL APARTADO", () => {
    // La comprobación de fondo. La explicación termina siempre en una cuenta
    // con su resultado; ese resultado tiene que ser el del apartado, en valor
    // absoluto al menos (la frase razona el signo aparte: "así que el
    // resultado es negativo" y luego "9 · 6 = 54").
    let comprobados = 0;
    for (const ej of conEjemplos()) {
      for (const a of ej.apartados.filter((x) => x.resuelto)) {
        if (!a.explicacion) continue;
        // EL MENOS SE NORMALIZA ANTES DE LEER LOS NÚMEROS. La explicación es
        // texto plano y escribe el menos tipográfico (U+2212), no el guion
        // ASCII, porque en el folio se veía la mezcla de los dos glifos en la
        // misma línea. Una expresión regular con `-?` no lo reconocería y
        // este test daría por perdida cada solución negativa.
        const plano = a.explicacion.replace(/\u2212/g, "-");
        const numeros = (plano.match(/-?\d+/g) || []).map(Number);
        assert.ok(
          numeros.includes(a.solucion) || numeros.includes(Math.abs(a.solucion)),
          `${ej.clave}: la solución es ${a.solucion} y la explicación no la dice: `
            + `"${a.explicacion}"`,
        );
        comprobados += 1;
      }
    }
    // Y que de verdad se haya comprobado algo: si un cambio dejara todas las
    // explicaciones en null, el bucle de arriba pasaría sin mirar nada.
    assert.ok(comprobados > 50, `solo se comprobaron ${comprobados} explicaciones`);
  });

  test("el apartado resuelto se imprime CON la respuesta, sin hueco", () => {
    for (const ej of conEjemplos()) {
      for (const a of ej.apartados.filter((x) => x.resuelto)) {
        assert.equal(
          a.latex.includes("___"),
          false,
          `${ej.clave}: el ejemplo sigue llevando hueco: "${a.latex}"`,
        );
        assert.ok(
          a.latex.includes(String(a.solucion)) || a.latex.includes(String(a.total)),
          `${ej.clave}: el ejemplo no muestra ningún resultado: "${a.latex}"`,
        );
      }
    }
  });

  test("los de práctica SIGUEN llevando hueco y sin la respuesta", () => {
    for (const ej of conEjemplos()) {
      for (const a of ej.apartados.filter((x) => !x.resuelto)) {
        assert.ok(a.latex.includes("___"), `${ej.clave}: apartado sin hueco: "${a.latex}"`);
      }
    }
  });

  test("la pareja (-3)^2 / -3^2 NO lleva ejemplo, y no es un olvido", () => {
    // Esa batería ES el ejemplo: su contenido es comparar las dos
    // expresiones, así que resolver una regala lo que hay que descubrir. Y
    // sus apartados van de dos en dos: uno de más rompe las filas.
    for (const s of SEMILLAS) {
      const ej = conEjemploResuelto(potencias.paresConYSinParentesis, crearAzar(s), { cuantos: 4 });
      assert.equal(ej.clave, "pares_con_y_sin_parentesis");
      assert.equal(ej.apartados.some((a) => a.resuelto), false, "no debería llevar ejemplo");
      assert.equal(ej.apartados.length % 2, 0, "las filas se han roto");
    }
  });

  test("la hoja recibe el ejemplo como objeto y los demás como cadena", () => {
    // La plantilla acepta las dos formas a propósito (ver actividades.js): la
    // hoja escrita a mano usa cadenas y no tiene por qué cambiar.
    for (const ej of conEjemplos()) {
      const act = aActividadDeHoja(ej);
      const primero = act.apartados[0];
      if (SIN_EJEMPLO.has(ej.clave)) {
        assert.equal(typeof primero, "string", `${ej.clave}: no debería llevar objeto`);
        continue;
      }
      assert.equal(typeof primero, "object", `${ej.clave}: el ejemplo tiene que bajar como objeto`);
      assert.equal(primero.resuelto, true);
      assert.ok(primero.texto, "el objeto necesita su texto");
      for (const resto of act.apartados.slice(1)) {
        assert.equal(typeof resto, "string", `${ej.clave}: un apartado normal bajó como objeto`);
      }
    }
  });

  test("LA CUENTA QUE ESCRIBE LA EXPLICACIÓN DA LA SOLUCIÓN DEL APARTADO", async () => {
    // El test más fuerte de este archivo. Las explicaciones de cadena y de
    // quitar paréntesis terminan en un desarrollo escrito (`Queda 7 + 7 − 8 =
    // 6`, `−7 − 2 = −9, −9 + 2 = −7`), y ese desarrollo se puede EVALUAR:
    // se suman los términos con su signo y tiene que salir lo mismo que el
    // apartado. Si el generador de la explicación se equivocara al cambiar un
    // signo al quitar el paréntesis —el error más fácil de cometer aquí— la
    // frase razonaría bien y daría otro número, y el alumno la seguiría hasta
    // una respuesta que el folio dice que está mal.
    let comprobadas = 0;
    for (const ej of conEjemplos()) {
      for (const a of ej.apartados.filter((x) => x.resuelto)) {
        const desarrollo = /Queda (.+?) = (\S+?)\.$/.exec(a.explicacion || "");
        if (!desarrollo) continue;
        const terminos = desarrollo[1]
          .replace(/\u2212/g, "-")
          .split(/\s+(?=[+-])/)
          .map((t) => Number(t.replace(/[+\s]/g, "")));
        const suma = terminos.reduce((n, t) => n + t, 0);
        assert.equal(
          suma,
          a.solucion,
          `${ej.clave}: "${desarrollo[1]}" suma ${suma} y el apartado vale ${a.solucion}`,
        );
        comprobadas += 1;
      }
    }
    assert.ok(comprobadas > 5, `solo se comprobaron ${comprobadas} desarrollos`);
  });

  test("con + delante del paréntesis NO se dice que el menos cambia los signos", async () => {
    // La regresión: `explicaQuitarParentesis` ponía siempre la frase del
    // menos, así que para `7 + (-7 + 8)` decía "el menos de delante cambia el
    // signo de TODO lo de dentro". Es falso y enseña justo lo contrario de lo
    // que hay que hacer con ese apartado.
    //
    // El desarrollo escrito seguía siendo correcto, así que el test que
    // evalúa la cuenta pasaba: la frase y la aritmética pueden decir cosas
    // distintas y solo se ve leyendo la frase.
    const { explicaArbol } = await import("../../server/lib/generadorEjercicios/explicacion.js");
    const { suma, resta, neg, evaluar } = await import(
      "../../server/lib/generadorEjercicios/expresion.js"
    );
    const CASOS = [
      { arbol: suma(7, suma(-7, 8)), cambia: false },
      { arbol: suma(2, resta(-11, 9)), cambia: false },
      { arbol: resta(7, suma(-7, 8)), cambia: true },
      { arbol: resta(-7, resta(8, 10)), cambia: true },
      { arbol: suma(neg(resta(-5, 4)), 11), cambia: true },
    ];
    for (const { arbol, cambia } of CASOS) {
      const { valor } = evaluar(arbol);
      const frase = explicaArbol(arbol, valor);
      assert.ok(frase, "sin explicación");
      assert.equal(
        /cambia el signo/.test(frase),
        cambia,
        `${cambia ? "debería" : "NO debería"} hablar de cambiar el signo: "${frase}"`,
      );
      assert.equal(
        /no cambian/.test(frase),
        !cambia,
        `la frase del + no encaja: "${frase}"`,
      );
    }
  });

  test("sin `latexResuelto` el ejemplo se imprime igual, no se rompe", () => {
    // Un ejemplo pobre es mejor que una cadena a medio parchear.
    const pelado = comoResuelto({ latex: "$1+1=$ ___", texto: "1 + 1 = ___", solucion: 2 });
    assert.equal(pelado.latex, "$1+1=$ ___");
    assert.equal(pelado.resuelto, true);
  });

  test("las soluciones de los apartados no cambian al añadir el ejemplo", () => {
    // El ejemplo se añade, no se recalcula nada: si esto fallara, el ejemplo
    // estaría desplazando las soluciones y la corrección quedaría corrida un
    // apartado.
    for (const g of GENERADORES) {
      const sin = g(crearAzar("mismo"), { cuantos: 5 });
      const con = conEjemploResuelto(g, crearAzar("mismo"), { cuantos: 4 });
      if (SIN_EJEMPLO.has(con.clave)) continue;
      const practica = con.apartados.filter((a) => !a.resuelto).map((a) => a.texto);
      assert.deepEqual(
        practica,
        sin.apartados.slice(0, 4).map((a) => a.texto),
        `${con.clave}: la práctica no son los mismos apartados`,
      );
    }
  });
}
