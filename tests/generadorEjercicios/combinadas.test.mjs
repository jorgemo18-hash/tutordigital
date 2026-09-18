// LOS GENERADORES DE OPERACIONES COMBINADAS (objetivo 6).
//
// El primer test es el que justifica todo este objetivo: la instrucción del
// catálogo dice *"si da lo mismo operar de izquierda a derecha, el ejercicio
// no sirve"*, y eso es exactamente el tipo de condición que un modelo cumple
// "casi siempre". En una batería de cuatro apartados, "casi siempre" quiere
// decir que uno no mide nada — y encima no se nota, porque el apartado parece
// perfectamente correcto.
export async function run({ test, assert }) {
  const gen = await import("../../server/lib/generadorEjercicios/generadores/combinadas.js");
  const { crearAzar } = await import("../../server/lib/generadorEjercicios/aleatorio.js");
  const { evaluar } = await import("../../server/lib/generadorEjercicios/expresion.js");
  const { conEjemploResuelto } = await import(
    "../../server/lib/generadorEjercicios/ejemploResuelto.js"
  );

  const TODOS = Object.entries(gen);
  const SEMILLAS = ["a", "b", "c", "d", "e", "f", 1, 2, 3, 42, 7777, 123456];
  const conSemillas = (fn, opciones) => SEMILLAS.map((s) => fn(crearAzar(s), opciones));

  // El resultado operando de izquierda a derecha, leído DEL TEXTO IMPRESO y
  // no de la secuencia interna: lo que importa es si el alumno que no sabe la
  // jerarquía llega al mismo número mirando el folio.
  //
  // Solo se puede hacer con las expresiones sin paréntesis, que son las que
  // esta comprobación necesita.
  const aLaBruta = (texto) => {
    if (/[[{]/.test(texto)) return undefined;
    // Los paréntesis de signo se quitan antes de partir: `4 + (-5) · 3` se
    // opera igual de izquierda a derecha, y esa expresión SÍ tiene que
    // comprobarse. Si se descartara, la comprobación se quedaría solo con las
    // expresiones de naturales, que son las menos.
    const plano = texto.replace(/\((-?\d+)\)/g, "$1");
    if (plano.includes("(")) return undefined;
    const piezas = plano.replace(/ = ___$/, "").trim().split(/\s+/);
    let valor = Number(piezas[0]);
    for (let i = 1; i < piezas.length; i += 2) {
      const b = Number(piezas[i + 1]);
      if (!Number.isFinite(b)) return undefined;
      if (piezas[i] === "+") valor += b;
      else if (piezas[i] === "-") valor -= b;
      else if (piezas[i] === "·") valor *= b;
      else if (piezas[i] === ":") valor /= b;
      else return undefined;
    }
    return valor;
  };

  // Paréntesis de AGRUPACIÓN, no los del signo de un número: `4 + (-5) · 3`
  // no lleva la jerarquía escrita, que es lo que el arquetipo prohíbe.
  const agrupa = (texto) => /[[{]/.test(texto) || texto.replace(/\(-?\d+\)/g, "").includes("(");

  test("LA SOLUCIÓN ES LA EXPRESIÓN RESUELTA, con la jerarquía puesta", () => {
    for (const [nombre, fn] of TODOS) {
      for (const ej of conSemillas(fn)) {
        for (const a of ej.apartados) {
          const { valor } = evaluar(a.arbol, { tope: 1e9 });
          assert.equal(a.solucion, valor, `${nombre}: "${a.texto}" dice ${a.solucion} y vale ${valor}`);
        }
      }
    }
  });

  test("EL ORDEN IMPORTA EN TODOS LOS APARTADOS, sin una sola excepción", () => {
    // Se lee el texto impreso y se opera a la bruta, de izquierda a derecha.
    // Si sale lo mismo que la solución, ese apartado no distingue al alumno
    // que sabe la jerarquía del que no, y no debería estar en la hoja.
    let comprobados = 0;
    for (const [nombre, fn] of TODOS) {
      for (const ej of conSemillas(fn)) {
        for (const a of ej.apartados) {
          const bruto = aLaBruta(a.texto);
          if (bruto === undefined) continue;
          assert.notEqual(
            bruto,
            a.solucion,
            `${nombre}: "${a.texto}" da ${a.solucion} también de izquierda a derecha`,
          );
          comprobados += 1;
        }
      }
    }
    // Y que se haya comprobado de verdad: si todas las expresiones acabaran
    // llevando paréntesis, el bucle pasaría sin mirar nada.
    assert.ok(comprobados > 60, `solo se comprobaron ${comprobados} apartados`);
  });

  test("la combinada de un nivel NO lleva paréntesis de agrupación: es la instrucción", () => {
    // Un paréntesis de agrupación le daría resuelto el orden al alumno, que
    // es justo lo que esta batería mide. Los del signo de un negativo sí
    // valen y hacen falta: `4 + -5` no es notación de libro.
    for (const ej of conSemillas(gen.combinadaDeUnNivel)) {
      for (const a of ej.apartados) {
        assert.equal(agrupa(a.texto), false, `"${a.texto}" lleva paréntesis de agrupación`);
      }
    }
  });

  test("y lleva al menos un producto o cociente, o no hay jerarquía que aplicar", () => {
    for (const [nombre, fn] of TODOS) {
      for (const ej of conSemillas(fn)) {
        for (const a of ej.apartados) {
          assert.ok(
            /[·:]/.test(a.texto),
            `${nombre}: "${a.texto}" solo tiene sumas y restas`,
          );
        }
      }
    }
  });

  test("subraya la preferente: la mitad llevan paréntesis, para que no valga un patrón", () => {
    // Si en todas mandara el producto, la respuesta a "¿qué va primero?" se
    // contestaría sin leer: siempre el producto. La batería dejaría de medir
    // si sabe la regla.
    for (const ej of conSemillas(gen.subrayaLaPreferente, { cuantos: 5 })) {
      // `agrupa` y no "lleva un paréntesis": desde que los términos pueden
      // ser negativos, `4 + (-5) · 3` también tiene paréntesis y NO es de los
      // que llevan grupo. Con el filtro ingenuo este test decía que todas lo
      // llevaban.
      const conGrupo = ej.apartados.filter((a) => agrupa(a.texto)).length;
      assert.ok(conGrupo >= 2, `solo ${conGrupo} con paréntesis de ${ej.apartados.length}`);
      assert.ok(conGrupo < ej.apartados.length, "todas llevan paréntesis");
    }
  });

  test("NINGÚN paréntesis vale 0 ni ±1, en ninguna de las tres baterías", () => {
    // Con `(7 - 6) · 4` el paréntesis deja de importar —multiplicar por 1 no
    // hace nada— y el apartado vuelve a ser contestable sin entender la
    // jerarquía. Con 0 es peor: se lleva el término entero por delante.
    //
    // La primera versión de este test solo miraba la batería del paréntesis
    // suelto, y en el folio salió `-3 · [5 - 4 · (7 - 6) - (4 - 4)]`: uno
    // valía 1 y el otro 0, en el apartado más difícil de la hoja.
    const baterias = [
      ...conSemillas(gen.subrayaLaPreferente),
      ...conSemillas(gen.combinadaConCorchetes),
    ];
    let comprobados = 0;
    for (const ej of baterias) {
      for (const a of ej.apartados) {
        // LOS PARÉNTESIS MÁS INTERIORES, y todos ellos.
        //
        // Dos correcciones sobre la primera versión de este test. Una:
        // buscaba con `exec`, así que en una combinada con dos paréntesis
        // dentro del corchete solo miraba el primero — y el `(4 - 4)` que
        // salió en el folio era el segundo.
        //
        // Y otra: el contenido no puede excluir solo los cierres, porque
        // entonces en `[6 - 2 · (10 + 2) - ...]` la captura empieza en el
        // corchete y acaba en el primer cierre, devolviendo el trozo
        // desparejado `6 - 2 · (10 + 2`. Excluyendo también las aperturas se
        // cogen exactamente los grupos sin nada anidado dentro, que son los
        // que tienen que valer algo.
        const sinSignos = a.texto.replace(/\((-?\d+)\)/g, "$1");
        const interiores = /[([]([^()[\]]*[+\-·:][^()[\]]*)[)\]]/g;
        for (const grupo of sinSignos.matchAll(interiores)) {
          const dentro = grupo[1].replace(/−/g, "-");
          // eslint-disable-next-line no-eval
          const valor = eval(dentro.replace(/ · /g, "*").replace(/ : /g, "/"));
          assert.ok(Math.abs(valor) > 1, `el paréntesis de "${a.texto}" vale ${valor}`);
          comprobados += 1;
        }
      }
    }
    assert.ok(comprobados > 40, `solo se comprobaron ${comprobados} paréntesis`);
  });

  test("con corchetes: DOS niveles, y el de fuera es un corchete de verdad", () => {
    // El catálogo lo escribe así —`2 · [8 - 4 · (10 - 6) - (-3 - 2)]`— y no
    // es decoración: con tres niveles de paréntesis iguales, emparejarlos es
    // un ejercicio de paciencia visual que no tiene que ver con la jerarquía.
    for (const ej of conSemillas(gen.combinadaConCorchetes)) {
      assert.ok(ej.apartados.length >= 2, `solo ${ej.apartados.length} apartados`);
      for (const a of ej.apartados) {
        assert.ok(a.texto.includes("["), `"${a.texto}" no lleva corchete`);
        assert.ok(a.texto.includes("("), `"${a.texto}" no lleva paréntesis dentro`);
        // Y EN EL LaTeX TAMBIÉN, que es lo que se imprime. El texto plano y
        // el LaTeX se envuelven con dos funciones distintas —en LaTeX hay que
        // escapar las llaves— así que comprobar solo una deja la otra sin
        // cubrir: la primera reversión que probé tocaba la de LaTeX y ningún
        // test se enteró.
        assert.ok(a.latex.includes("["), `el LaTeX no lleva corchete: "${a.latex}"`);
        // Máximo dos niveles: el arquetipo lo dice expresamente ("con tres la
        // hoja se convierte en un examen de paciencia"), así que nada de
        // llaves.
        assert.equal(a.texto.includes("{"), false, `"${a.texto}" tiene tres niveles`);
      }
    }
  });

  test("ninguna combinada sale sin un número negativo", () => {
    // Sin negativos es una combinada de naturales con corchetes: correcta y
    // de otro tema. Mismo criterio que en las demás baterías de enteros.
    for (const [nombre, fn] of TODOS) {
      for (const ej of conSemillas(fn)) {
        const sinNegativo = ej.apartados.filter((a) => !/-\d/.test(a.texto));
        assert.ok(
          sinNegativo.length <= 1,
          `${nombre}: ${sinNegativo.length} apartados sin negativos: `
            + sinNegativo.map((a) => a.texto).join(" | "),
        );
      }
    }
  });

  test("los números caben en la cabeza: no hay calculadora en 1.º ESO", () => {
    for (const [nombre, fn] of TODOS) {
      for (const ej of conSemillas(fn)) {
        for (const a of ej.apartados) {
          for (const n of a.texto.match(/\d+/g) || []) {
            assert.ok(Number(n) <= 12, `${nombre}: ${n} en "${a.texto}" es demasiado`);
          }
          assert.ok(
            Math.abs(a.solucion) <= 500,
            `${nombre}: "${a.texto}" da ${a.solucion}`,
          );
        }
      }
    }
  });

  test("el ejemplo resuelto de una combinada lleva el DESARROLLO, no la regla", () => {
    // Es el apartado más difícil de la hoja y su ejemplo es lo más valioso de
    // la página. "El paréntesis manda: primero lo de dentro" es verdad y no
    // resuelve nada: el que se pierde en una combinada no se pierde en la
    // regla, se pierde a mitad del desarrollo.
    for (const g of [gen.combinadaDeUnNivel, gen.subrayaLaPreferente, gen.combinadaConCorchetes]) {
      for (const s of SEMILLAS) {
        const ej = conEjemploResuelto(g, crearAzar(s), { cuantos: 3 });
        const ejemplo = ej.apartados.find((a) => a.resuelto);
        assert.ok(ejemplo, `${ej.clave}: sin ejemplo`);
        assert.ok(ejemplo.explicacion, `${ej.clave}: el ejemplo no lleva explicación`);
        // Un desarrollo tiene al menos dos igualdades: la del primer paso y
        // la del resultado.
        const igualdades = (ejemplo.explicacion.match(/=/g) || []).length;
        assert.ok(
          igualdades >= 2,
          `${ej.clave}: la explicación no desarrolla: "${ejemplo.explicacion}"`,
        );
        // Y termina en la solución del apartado. Se normaliza el menos
        // tipográfico a guion antes de comparar: la explicación escribe `−16`
        // y `solucion` es el número -16.
        const plano = ejemplo.explicacion.replace(/\u2212/g, "-");
        assert.ok(
          new RegExp(`= ${ejemplo.solucion}\\.$`).test(plano),
          `${ej.clave}: el desarrollo no acaba en ${ejemplo.solucion}: "${ejemplo.explicacion}"`,
        );
      }
    }
  });
}
