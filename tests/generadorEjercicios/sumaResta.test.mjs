// LOS GENERADORES DE SUMA Y RESTA, contra las instrucciones del catálogo.
//
// La tesis que justifica que aquí no haya ningún modelo es esta: las
// instrucciones de los arquetipos sembrados NO son sugerencias de estilo, son
// restricciones exactas — "cubre los cuatro casos de signos", "reparte a
// mitades cuál tiene mayor valor absoluto", "al menos dos con un signo menos
// delante del paréntesis". Una restricción exacta se CUMPLE con código o se
// APROXIMA con un modelo.
//
// Estos tests son la prueba de esa tesis: cada uno comprueba una instrucción
// del catálogo sobre la batería generada. Si algún día un modelo sustituyera
// a estos generadores, estos mismos tests dirían cuántas veces falla.
export async function run({ test, assert }) {
  const gen = await import("../../server/lib/generadorEjercicios/generadores/sumaResta.js");
  const { crearAzar } = await import("../../server/lib/generadorEjercicios/aleatorio.js");
  const { evaluar } = await import("../../server/lib/generadorEjercicios/expresion.js");
  const { aActividadDeHoja, solucionesDe } = await import(
    "../../server/lib/generadorEjercicios/ejercicio.js"
  );

  const TODOS = Object.entries(gen);
  // Varias semillas: una batería puede cumplir una condición por suerte.
  const SEMILLAS = ["a", "b", "c", "d", "e", "f", 1, 2, 3, 42, 7777, 123456];

  const conSemillas = (fn, opciones) => SEMILLAS.map((s) => fn(crearAzar(s), opciones));

  // ── Invariantes que valen para TODOS los generadores ──────────────────

  test("EL PUNTO DE TODO: la solución de cada apartado es su expresión resuelta", () => {
    // Si esto falla, la hoja lleva una solución que no corresponde al
    // enunciado, y no se descubre hasta que un alumno la corrige en clase.
    for (const [nombre, fn] of TODOS) {
      for (const ej of conSemillas(fn)) {
        for (const a of ej.apartados) {
          if (!a.arbol) continue;
          // `terminoQueFalta` tapa un término: su solución es el término
          // oculto, no el total, así que se comprueba aparte más abajo.
          if (ej.clave === "termino_que_falta") continue;
          const { valor } = evaluar(a.arbol, { tope: 1e9 });
          assert.equal(a.solucion, valor, `${nombre}: "${a.texto}" dice ${a.solucion} y vale ${valor}`);
        }
      }
    }
  });

  test("ningún apartado se repite dentro de la misma batería", () => {
    for (const [nombre, fn] of TODOS) {
      for (const ej of conSemillas(fn)) {
        const textos = ej.apartados.map((a) => a.texto);
        assert.equal(new Set(textos).size, textos.length, `${nombre} repite: ${textos.join(" | ")}`);
      }
    }
  });

  test("EL PUNTO DE TODO del no-repetir: con MUY pocos números posibles, tampoco repite", () => {
    // El test de arriba pasaba igual con el filtro de duplicados quitado:
    // con números de dos cifras las colisiones casi no salen, así que no
    // demostraba nada. Comprobado revirtiendo el filtro: 0 fallos.
    //
    // Con el rango apretado a tres valores, las combinaciones posibles se
    // cuentan con los dedos y repetir es lo que pasaría solo. Si el
    // generador devuelve menos apartados de los pedidos, es lo correcto:
    // mejor una batería de cinco que una con dos iguales.
    for (const [nombre, fn] of TODOS) {
      for (const semilla of SEMILLAS) {
        const ej = fn(crearAzar(semilla), { cuantos: 8, tope: 3 });
        const textos = ej.apartados.map((a) => a.texto);
        assert.equal(
          new Set(textos).size, textos.length,
          `${nombre} repite con el rango apretado: ${textos.join(" | ")}`
        );
      }
    }
  });

  test("EL PUNTO DE TODO: los `$` van emparejados y el hueco NUNCA va dentro", () => {
    // Es el fallo que la plantilla no puede absorber. La hoja convierte
    // `___` en un <span> ANTES de que KaTeX recorra el folio, y KaTeX no
    // empareja un `$` de apertura con uno de cierre que estén a lados
    // distintos de un elemento. Un hueco dentro de la fórmula parte el par y
    // el apartado se imprime en crudo, con los dólares a la vista.
    for (const [nombre, fn] of TODOS) {
      for (const ej of conSemillas(fn)) {
        for (const a of ej.apartados) {
          const trozos = a.latex.split("$");
          assert.equal(
            trozos.length % 2, 1,
            `${nombre}: dólares desparejados en "${a.latex}"`
          );
          // Los trozos impares son lo que va DENTRO de las fórmulas.
          for (let i = 1; i < trozos.length; i += 2) {
            assert.ok(
              !trozos[i].includes("___"),
              `${nombre}: hueco dentro de la fórmula en "${a.latex}"`
            );
          }
        }
      }
    }
  });

  test("cada batería tiene apartados: un generador que devuelve 0 es un fallo mudo", () => {
    for (const [nombre, fn] of TODOS) {
      for (const ej of conSemillas(fn)) {
        assert.ok(ej.apartados.length >= 4, `${nombre} solo generó ${ej.apartados.length}`);
      }
    }
  });

  test("la misma semilla da exactamente la misma batería", () => {
    for (const [nombre, fn] of TODOS) {
      const a = fn(crearAzar("repetible"));
      const b = fn(crearAzar("repetible"));
      assert.deepEqual(
        a.apartados.map((x) => x.texto), b.apartados.map((x) => x.texto),
        `${nombre} no es reproducible`
      );
    }
  });

  test("y dos semillas distintas dan baterías distintas", () => {
    for (const [nombre, fn] of TODOS) {
      const a = fn(crearAzar("uno")).apartados.map((x) => x.texto).join("|");
      const b = fn(crearAzar("dos")).apartados.map((x) => x.texto).join("|");
      assert.notEqual(a, b, `${nombre} da lo mismo con cualquier semilla`);
    }
  });

  test("sin calculadora: ningún número impreso pasa de tres cifras", () => {
    for (const [nombre, fn] of TODOS) {
      for (const ej of conSemillas(fn)) {
        for (const a of ej.apartados) {
          for (const n of a.texto.match(/\d+/g) || []) {
            assert.ok(
              Number(n) <= 999,
              `${nombre}: "${a.texto}" tiene un ${n}, y en 1.º ESO no hay calculadora`
            );
          }
        }
      }
    }
  });

  // ── LA HOJA NO LLEVA SOLUCIONES ───────────────────────────────────────

  test("EL PUNTO DE TODO: la actividad que va al folio NO lleva las soluciones", () => {
    // El generador las calcula (sin ellas no hay forma de corregir), pero al
    // papel no van. Si se colaran, el profesor repartiría la hoja resuelta.
    for (const [, fn] of TODOS) {
      const ej = fn(crearAzar("folio"));
      const actividad = aActividadDeHoja(ej);
      const serializada = JSON.stringify(actividad);
      assert.ok(!serializada.includes("solucion"), "la palabra solución no puede estar");

      // EL HUECO TIENE QUE SEGUIR AHÍ. Es la comprobación con dientes: si
      // alguien rellenara el hueco con la solución, esto lo caza. La versión
      // anterior de este test buscaba `= N` y no lo cazaba, porque entre el
      // `=` y el número queda el `$` de cierre de la fórmula — comprobado
      // revirtiéndolo: pasaba igual con el folio resuelto.
      for (let i = 0; i < ej.apartados.length; i += 1) {
        if (!ej.apartados[i].latex.includes("___")) continue;
        assert.ok(
          actividad.apartados[i].includes("___"),
          `el hueco desapareció del folio: "${actividad.apartados[i]}"`
        );
      }

      // Y ninguna solución de dos o más cifras puede aparecer suelta en el
      // apartado, quitando antes los dólares y los espacios para que no
      // haya sitio donde esconderse.
      for (let i = 0; i < ej.apartados.length; i += 1) {
        const sol = ej.apartados[i].solucion;
        if (Math.abs(sol) < 10) continue;
        const desnudo = actividad.apartados[i].replace(/[$\s]/g, "");
        const yaEstabaEnElEnunciado = ej.apartados[i].latex.replace(/[$\s]/g, "").includes(String(sol));
        if (yaEstabaEnElEnunciado) continue;
        assert.ok(
          !desnudo.includes(String(sol)),
          `la solución ${sol} aparece en el folio: "${actividad.apartados[i]}"`
        );
      }
    }
  });

  test("la actividad tiene la forma que espera la plantilla de la hoja", () => {
    // Misma forma que assets/shared/hoja/muestras/enteros1eso.js.
    const actividad = aActividadDeHoja(gen.sumaMismoSigno(crearAzar("forma")));
    assert.equal(typeof actividad.enunciado, "string");
    assert.ok(["ejercicio", "problema"].includes(actividad.tipo));
    assert.ok([1, 2, 3].includes(actividad.dificultad));
    assert.ok(Array.isArray(actividad.apartados));
    assert.ok(actividad.apartados.every((a) => typeof a === "string"));
  });

  // ── Instrucción por instrucción ───────────────────────────────────────

  test("suma del mismo signo: los DOS sumandos tienen el mismo signo", () => {
    for (const ej of conSemillas(gen.sumaMismoSigno)) {
      for (const a of ej.apartados) {
        const { izq, der } = a.arbol;
        const b = a.arbol.simbolo === "-" ? -der.valor : der.valor;
        assert.ok(
          Math.sign(izq.valor) === Math.sign(b),
          `"${a.texto}" mezcla signos, y eso es el otro arquetipo`
        );
      }
    }
  });

  test("suma del mismo signo: la mayoría son NEGATIVOS, que es donde está el tema", () => {
    // Salió de mirar la primera tanda: con el signo a partes iguales, media
    // batería eran sumas como `84 + 42`, que se hacen en primaria.
    for (const ej of conSemillas(gen.sumaMismoSigno)) {
      const negativos = ej.apartados.filter((a) => a.arbol.izq.valor < 0).length;
      assert.ok(
        negativos >= ej.apartados.length - 2,
        `solo ${negativos} de ${ej.apartados.length} son negativos`
      );
    }
  });

  test("suma del mismo signo: aparecen LAS DOS escrituras del catálogo", () => {
    // La instrucción dice "mezcla las dos escrituras": `-6 + (-1)` y `-4 - 6`.
    const conParentesis = [];
    const comoResta = [];
    for (const ej of conSemillas(gen.sumaMismoSigno)) {
      for (const a of ej.apartados) {
        (a.arbol.simbolo === "-" ? comoResta : conParentesis).push(a.texto);
      }
    }
    assert.ok(conParentesis.length > 0, "falta la escritura con paréntesis");
    assert.ok(comoResta.length > 0, "falta la escritura como resta");
  });

  test("suma de distinto signo: los sumandos tienen SIGNOS OPUESTOS", () => {
    for (const ej of conSemillas(gen.sumaDistintoSigno)) {
      for (const a of ej.apartados) {
        assert.ok(
          Math.sign(a.arbol.izq.valor) !== Math.sign(a.arbol.der.valor),
          `"${a.texto}" no mezcla signos`
        );
      }
    }
  });

  test("suma de distinto signo: el resultado NO sale siempre del mismo signo", () => {
    // Es literalmente la instrucción del arquetipo, y es lo que impide que
    // el alumno acierte por patrón sin mirar los números.
    for (const ej of conSemillas(gen.sumaDistintoSigno)) {
      const positivos = ej.apartados.filter((a) => a.solucion > 0).length;
      const negativos = ej.apartados.filter((a) => a.solucion < 0).length;
      assert.ok(positivos >= 2 && negativos >= 2, `${positivos} positivos y ${negativos} negativos`);
    }
  });

  test("resta con paréntesis: LOS CUATRO casos de signos salen siempre", () => {
    // (+)-(+), (+)-(-), (-)-(+), (-)-(-). Es lo que convierte la batería en
    // un diagnóstico en vez de en relleno.
    for (const ej of conSemillas(gen.restaConParentesis)) {
      const casos = new Set(
        ej.apartados.map((a) => `${Math.sign(a.arbol.izq.valor)},${Math.sign(a.arbol.der.valor)}`)
      );
      assert.equal(casos.size, 4, `solo salieron ${casos.size} casos: ${[...casos].join(" ")}`);
    }
  });

  test("resta con paréntesis: los negativos van envueltos, también el de la izquierda", () => {
    for (const ej of conSemillas(gen.restaConParentesis)) {
      for (const a of ej.apartados) {
        if (a.arbol.izq.valor < 0) {
          assert.ok(a.texto.startsWith("("), `"${a.texto}" debería empezar con paréntesis`);
        }
      }
    }
  });

  test("término que falta: la solución es el término TAPADO, y cuadra la igualdad", () => {
    for (const ej of conSemillas(gen.terminoQueFalta)) {
      for (const a of ej.apartados) {
        // Se reconstruye la igualdad metiendo la solución en el hueco.
        const [izquierda, derecha] = a.texto.split(" = ");
        const conSolucion = izquierda.replace("___", `(${a.solucion})`);
        // eslint-disable-next-line no-eval
        assert.equal(eval(conSolucion), Number(derecha), `"${a.texto}" con ${a.solucion} no cuadra`);
      }
    }
  });

  test("término que falta: NINGÚN apartado con los tres números positivos", () => {
    // `8 + ___ = 25` no ejercita nada de este tema: es una resta de primaria
    // escrita del revés, y en el primer folio generado salieron dos así de
    // cuatro apartados.
    //
    // LA CONDICIÓN NO ES "QUE SE VEA UN MENOS", y esa es la parte que importa:
    // `2 - ___ = 25` tampoco muestra un negativo y sin embargo es un
    // ejercicio de enteros de pleno derecho, porque la respuesta es -23 y
    // llegar a ella ES el contenido. Así que se mira también la solución.
    for (const ej of conSemillas(gen.terminoQueFalta)) {
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

  test("término que falta: el hueco CAMBIA de sitio", () => {
    // La instrucción lo pide expresamente: "no siempre el segundo término".
    for (const ej of conSemillas(gen.terminoQueFalta)) {
      const delante = ej.apartados.filter((a) => a.texto.startsWith("___")).length;
      assert.ok(delante > 0, "el hueco nunca va delante");
      assert.ok(delante < ej.apartados.length, "el hueco va siempre delante");
    }
  });

  test("cadena: entre 4 y 7 términos, sin paréntesis", () => {
    for (const ej of conSemillas(gen.cadenaSumasRestas)) {
      for (const a of ej.apartados) {
        assert.ok(!a.texto.includes("("), `"${a.texto}" lleva paréntesis y no debería`);
        const terminos = (a.texto.match(/\d+/g) || []).length;
        assert.ok(terminos >= 4 && terminos <= 7, `"${a.texto}" tiene ${terminos} términos`);
      }
    }
  });

  test("cadena: lleva suma Y resta — una cadena de un solo signo no ejercita nada", () => {
    // Salió de mirar el folio impreso: el primer apartado era
    // `-1 + 8 + 8 + 1`, todo sumas. El arquetipo se llama "cadena de sumas Y
    // restas" y lo que ejercita es alternar.
    for (const ej of conSemillas(gen.cadenaSumasRestas)) {
      for (const a of ej.apartados) {
        const cuerpo = a.texto.replace(/^-/, "").replace(" = ___", "");
        assert.ok(cuerpo.includes("+"), `"${a.texto}" no tiene ninguna suma`);
        assert.ok(cuerpo.includes("-"), `"${a.texto}" no tiene ninguna resta`);
      }
    }
  });

  test("cadena: el resultado es de una o dos cifras, como pide la instrucción", () => {
    for (const ej of conSemillas(gen.cadenaSumasRestas)) {
      for (const a of ej.apartados) {
        assert.ok(Math.abs(a.solucion) <= 99, `"${a.texto}" da ${a.solucion}`);
      }
    }
  });

  test("elimina paréntesis: al menos DOS con el menos delante del paréntesis", () => {
    // Sin esa condición, media batería no ejercita lo que se está dando.
    for (const ej of conSemillas(gen.eliminaParentesis)) {
      const conMenos = ej.apartados.filter((a) => /-\s*\(/.test(a.texto)).length;
      assert.ok(conMenos >= 2, `solo ${conMenos} de ${ej.apartados.length}: ${ej.apartados.map((a) => a.texto).join(" | ")}`);
    }
  });

  test("elimina paréntesis: UN SOLO nivel, como pide el arquetipo", () => {
    // "Máximo dos niveles: con tres la hoja se convierte en un examen de
    // paciencia" — y este arquetipo es el de un nivel.
    for (const ej of conSemillas(gen.eliminaParentesis)) {
      for (const a of ej.apartados) {
        let profundidad = 0;
        let maxima = 0;
        for (const c of a.texto) {
          if (c === "(") { profundidad += 1; maxima = Math.max(maxima, profundidad); }
          if (c === ")") profundidad -= 1;
        }
        assert.ok(maxima <= 2, `"${a.texto}" anida ${maxima} niveles`);
      }
    }
  });

  test("todos los generadores declaran a qué arquetipo del catálogo responden", () => {
    // Es lo que permitirá enlazar el ejercicio generado con su arquetipo en
    // la base de datos, y sin eso no hay forma de retirar un arquetipo malo.
    for (const [nombre, fn] of TODOS) {
      const ej = fn(crearAzar("trazas"));
      assert.ok(ej.clave, `${nombre} no tiene clave`);
      assert.ok(ej.arquetipo, `${nombre} no dice de qué arquetipo viene`);
      assert.ok([1, 2, 3].includes(ej.dificultad), `${nombre} tiene dificultad ${ej.dificultad}`);
    }
  });
}
