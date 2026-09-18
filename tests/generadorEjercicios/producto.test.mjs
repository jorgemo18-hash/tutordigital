// LOS GENERADORES DE PRODUCTO Y COCIENTE, contra las instrucciones del
// catálogo. Misma tesis que en `sumaResta.test.mjs`: las instrucciones de los
// arquetipos son restricciones exactas, y una restricción exacta se comprueba.
//
// Dos de estos tests son los que de verdad importan, porque cubren errores
// que ya se colaron una vez y que NO se ven leyendo el código:
//
//   - que la división sea exacta SIEMPRE (un cociente decimal convierte el
//     ejercicio en otro tema que el alumno no ha dado);
//   - que la batería no se llene de apartados sin un solo número negativo,
//     que es aritmética de primaria disfrazada de enteros.
export async function run({ test, assert }) {
  const gen = await import("../../server/lib/generadorEjercicios/generadores/producto.js");
  const { crearAzar } = await import("../../server/lib/generadorEjercicios/aleatorio.js");
  const { evaluar } = await import("../../server/lib/generadorEjercicios/expresion.js");

  const TODOS = Object.entries(gen);
  const SEMILLAS = ["a", "b", "c", "d", "e", "f", 1, 2, 3, 42, 7777, 123456];
  const conSemillas = (fn, opciones) => SEMILLAS.map((s) => fn(crearAzar(s), opciones));

  // Los signos de los dos números que se imprimen, leídos del TEXTO y no del
  // árbol: lo que importa es lo que ve el alumno.
  const numerosDe = (texto) => (texto.match(/-?\d+/g) || []).map(Number);

  // ¿Lleva un paréntesis de AGRUPACIÓN, o solo los del signo de un número?
  //
  // Mi primer intento midió la profundidad de anidamiento, y era un test
  // roto: con negativos la agrupación es el segundo nivel
  // (`(-75) : ((-3) · (-5))`) y con positivos el primero (`60 : (2 · 6)`),
  // así que ningún umbral fijo vale. Se quitan primero los paréntesis que
  // solo envuelven un número y se mira si queda alguno.
  // El grupo del segundo nivel se imprime con CORCHETE, como el catálogo
  // (`-18 : [(-3) · (-2)]`), así que cuenta también el corchete.
  const agrupa = (texto) => /[[]/.test(texto) || texto.replace(/\(-?\d+\)/g, "").includes("(");

  // ── Invariantes de las cuatro baterías ────────────────────────────────

  test("la solución de cada apartado es su expresión resuelta", () => {
    for (const [nombre, fn] of TODOS) {
      for (const ej of conSemillas(fn)) {
        for (const a of ej.apartados) {
          // `factorQueFalta` tapa un operando: su solución es el operando
          // oculto, no el total. Se comprueba aparte, más abajo.
          if (ej.clave === "factor_que_falta") continue;
          const { valor } = evaluar(a.arbol, { tope: 1e9 });
          assert.equal(a.solucion, valor, `${nombre}: "${a.texto}" dice ${a.solucion} y vale ${valor}`);
        }
      }
    }
  });

  test("ninguna batería sale vacía ni corta con las opciones por defecto", () => {
    for (const [nombre, fn] of TODOS) {
      for (const ej of conSemillas(fn)) {
        assert.ok(ej.apartados.length >= 3, `${nombre}: solo ${ej.apartados.length} apartados`);
      }
    }
  });

  test("toda solución es entera: ninguna batería deja un decimal en la hoja", () => {
    for (const [nombre, fn] of TODOS) {
      for (const ej of conSemillas(fn)) {
        for (const a of ej.apartados) {
          assert.ok(
            Number.isInteger(a.solucion),
            `${nombre}: "${a.texto}" da ${a.solucion}, que no es entero`,
          );
        }
      }
    }
  });

  // ── Multiplica dos enteros ────────────────────────────────────────────

  test("multiplica: las cuatro combinaciones de signos salen SIEMPRE", () => {
    for (const ej of conSemillas(gen.multiplicaDosEnteros, { cuantos: 6 })) {
      const casos = new Set(
        ej.apartados.map((a) => {
          const [x, y] = numerosDe(a.texto);
          return `${Math.sign(x)}${Math.sign(y)}`;
        }),
      );
      assert.equal(casos.size, 4, `solo ${casos.size} combinaciones: ${[...casos].join(" ")}`);
    }
  });

  test("multiplica: factores de la tabla de multiplicar, sin 0 ni 1", () => {
    // La instrucción del catálogo es explícita: "lo que se practica es el
    // signo, no la multiplicación". Un factor 0 o 1 no ejercita el signo y un
    // factor de tres cifras ejercita otra cosa.
    for (const ej of conSemillas(gen.multiplicaDosEnteros)) {
      for (const a of ej.apartados) {
        for (const n of numerosDe(a.texto)) {
          assert.ok(Math.abs(n) >= 2 && Math.abs(n) <= 10, `factor fuera de la tabla: ${n} en "${a.texto}"`);
        }
      }
    }
  });

  test("COMO MUCHO UN apartado de dos positivos, aunque la batería sea larga", () => {
    // La regresión, vista en una hoja de refuerzo impresa: la batería de
    // multiplicar salió con nueve apartados y CINCO de dos positivos
    // (`8 · 8`, `9 · 10`, `6 · 6`, `2 · 8`, `2 · 7`). Media batería de tabla
    // de multiplicar de primaria dentro de una hoja de enteros.
    //
    // Con `cuantos` pequeño no se notaba: los cuatro casos obligatorios
    // ocupan los primeros puestos y no queda sitio para que el sorteo
    // acumule. El defecto solo aparece con las baterías largas, que son
    // justamente las de las hojas de refuerzo.
    for (const fn of [gen.multiplicaDosEnteros, gen.divideDosEnteros]) {
      for (const cuantos of [6, 8, 9]) {
        for (const ej of conSemillas(fn, { cuantos })) {
          const positivos = ej.apartados.filter((a) => !a.texto.includes("-"));
          assert.ok(
            positivos.length <= 1,
            `${ej.clave} con ${cuantos}: ${positivos.length} de dos positivos `
              + `(${positivos.map((a) => a.texto).join(", ")})`,
          );
        }
      }
    }
  });

  test("multiplica: el signo del número se ve separado del de la operación", () => {
    // `parentesisSiempre`: el catálogo escribe `(-3) · 5`, no `-3 · 5`.
    for (const ej of conSemillas(gen.multiplicaDosEnteros)) {
      for (const a of ej.apartados) {
        const sinParentesis = a.texto.replace(/\(-?\d+\)/g, "");
        assert.ok(
          !/-\d/.test(sinParentesis),
          `negativo sin paréntesis en "${a.texto}"`,
        );
      }
    }
  });

  // ── Divide dos enteros ────────────────────────────────────────────────

  test("divide: LA DIVISIÓN ES EXACTA SIEMPRE, sin una sola excepción", () => {
    // Es la instrucción más tajante del catálogo para esta batería, y la que
    // no se puede dejar al azar: un cociente decimal en una hoja de enteros
    // es un ejercicio que el alumno no puede hacer.
    for (const ej of conSemillas(gen.divideDosEnteros)) {
      for (const a of ej.apartados) {
        const [dividendo, divisor] = numerosDe(a.texto);
        assert.equal(divisor === 0, false, `divisor 0 en "${a.texto}"`);
        // `=== 0` y no `assert.equal(resto, 0)`: en JavaScript `-42 % -6` es
        // `-0`, y el `assert` estricto del runner distingue `-0` de `0`.
        assert.equal(dividendo % divisor === 0, true, `"${a.texto}" no es exacta`);
        assert.equal(a.solucion, dividendo / divisor, `"${a.texto}" dice ${a.solucion}`);
      }
    }
  });

  test("divide: las cuatro combinaciones de signos salen SIEMPRE", () => {
    for (const ej of conSemillas(gen.divideDosEnteros, { cuantos: 6 })) {
      const casos = new Set(
        ej.apartados.map((a) => {
          const [x, y] = numerosDe(a.texto);
          return `${Math.sign(x)}${Math.sign(y)}`;
        }),
      );
      assert.equal(casos.size, 4, `solo ${casos.size} combinaciones: ${[...casos].join(" ")}`);
    }
  });

  // ── Cadena de productos y cocientes ───────────────────────────────────

  test("cadena: hay una pareja con los MISMOS números cuyo paréntesis cambia el resultado", () => {
    // La instrucción pide "alguno donde el paréntesis cambia el resultado
    // respecto a operar de izquierda a derecha", y eso solo se demuestra con
    // dos apartados comparables: si los números fueran distintos, el alumno
    // podría atribuirles la diferencia a ellos.
    for (const ej of conSemillas(gen.cadenaProductosCocientes)) {
      const huella = (t) => (t.match(/-?\d+/g) || []).join(",");
      let encontrada = false;
      for (let i = 0; i + 1 < ej.apartados.length; i += 1) {
        const a = ej.apartados[i];
        const b = ej.apartados[i + 1];
        if (huella(a.texto) !== huella(b.texto)) continue;
        assert.notEqual(a.solucion, b.solucion, `la pareja "${a.texto}" da lo mismo que "${b.texto}"`);
        // Y una de las dos lleva paréntesis de agrupación y la otra no.
        assert.notEqual(
          agrupa(a.texto),
          agrupa(b.texto),
          `ninguna agrupa: "${a.texto}" / "${b.texto}"`,
        );
        encontrada = true;
        break;
      }
      assert.ok(encontrada, `sin pareja comparable en: ${ej.apartados.map((a) => a.texto).join(" | ")}`);
    }
  });

  test("cadena: ningún apartado sin un solo número negativo", () => {
    // El folio imprimió `2 · 3 : 3 · 5 = ___`. Es una cadena correcta, el
    // orden importa, y no tiene un solo signo que aplicar: en una hoja de
    // enteros eso es relleno.
    // DOSCIENTAS SEMILLAS Y NO DOCE, y esto no es celo: la pareja sortea tres
    // signos, así que los tres salen positivos una vez de cada ocho. Con las
    // doce semillas habituales este test PASABA con la protección revertida
    // —lo comprobé— y no demostraba nada. El caso raro hay que ir a buscarlo.
    for (let s = 0; s < 200; s += 1) {
      const ej = gen.cadenaProductosCocientes(crearAzar(`cadena-${s}`));
      for (const a of ej.apartados) {
        assert.ok(
          numerosDe(a.texto).some((n) => n < 0),
          `cadena sin negativos (semilla ${s}): "${a.texto}"`,
        );
      }
    }
  });

  // ── Halla el factor que falta ─────────────────────────────────────────

  test("factor que falta: el número tapado completa la igualdad impresa", () => {
    // La comprobación de fondo: la solución tiene que ser UNO de los dos
    // operandos del árbol, el total impreso tiene que ser el valor del árbol,
    // y el número visible tiene que ser EL OTRO operando. Con esas tres
    // cosas, escribir la solución en el hueco reproduce la igualdad.
    for (const ej of conSemillas(gen.factorQueFalta)) {
      for (const a of ej.apartados) {
        const { valor } = evaluar(a.arbol, { tope: 1e9 });
        const total = Number(a.texto.split("=").pop().trim());
        assert.equal(total, valor, `"${a.texto}": el total impreso no es el del árbol (${valor})`);
        const operandos = [a.arbol.izq.valor, a.arbol.der.valor];
        assert.ok(operandos.includes(a.solucion), `"${a.texto}": ${a.solucion} no es operando de la expresión`);
        const visible = a.solucion === operandos[0] ? operandos[1] : operandos[0];
        const izquierda = a.texto.split("=")[0];
        assert.ok(
          izquierda.includes(String(visible)),
          `"${a.texto}": el número visible debería ser ${visible}`,
        );
      }
    }
  });

  test("factor que falta: el hueco cambia de lado dentro de la misma batería", () => {
    for (const ej of conSemillas(gen.factorQueFalta)) {
      const empiezaPorHueco = ej.apartados.filter((a) => a.texto.startsWith("___")).length;
      assert.ok(
        empiezaPorHueco > 0 && empiezaPorHueco < ej.apartados.length,
        `el hueco está siempre en el mismo sitio: ${ej.apartados.map((a) => a.texto).join(" | ")}`,
      );
    }
  });

  test("factor que falta: NINGÚN apartado con los tres números positivos", () => {
    // Dos regresiones distintas en el mismo test.
    //
    // La primera: con los signos sorteados en vez de repartidos salieron
    // baterías con tres de cinco apartados todo positivos (`7 · ___ = 70`,
    // `6 · ___ = 36`, `___ : 8 = 2`).
    //
    // La segunda, más sutil y la que se me escapó: repartir los cuatro casos
    // de signos NO basta cuando hay un hueco, porque el hueco puede tapar
    // justo el número negativo y el apartado se imprime todo positivo de
    // todas formas (`18 : ___ = 9`). El criterio tiene que mirar también la
    // SOLUCIÓN, que es donde el signo puede estar escondido.
    for (const ej of conSemillas(gen.factorQueFalta)) {
      const sinContenido = ej.apartados.filter(
        (a) => a.visible >= 0 && a.total >= 0 && a.solucion >= 0,
      );
      assert.equal(
        sinContenido.length,
        0,
        `apartados sin un solo negativo: ${sinContenido.map((a) => a.texto).join(" | ")}`,
      );
    }
  });
}
