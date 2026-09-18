import fs from "node:fs";

const RAIZ = new URL("../../", import.meta.url).pathname;

// EL CATÁLOGO: qué batería sirve a qué objetivo.
//
// Esta tabla une dos mundos que pueden separarse sin que nada se queje: los
// objetivos y los arquetipos viven en la base de datos (migraciones 120 y
// 123) y los generadores son código. El primer test de este archivo es el
// que vigila esa costura, y es el motivo de que el archivo exista.
export async function run({ test, assert }) {
  const {
    BATERIAS_POR_OBJETIVO, OBJETIVOS, bateriasPropias, bateriasDeRepaso, bateriasParaObjetivo,
  } = await import("../../server/lib/generadorEjercicios/catalogoDeBaterias.js");
  const { crearAzar } = await import("../../server/lib/generadorEjercicios/aleatorio.js");

  const sumaResta = await import("../../server/lib/generadorEjercicios/generadores/sumaResta.js");
  const producto = await import("../../server/lib/generadorEjercicios/generadores/producto.js");
  const potencias = await import("../../server/lib/generadorEjercicios/generadores/potencias.js");
  const combinadas = await import("../../server/lib/generadorEjercicios/generadores/combinadas.js");

  const TODAS = Object.entries(BATERIAS_POR_OBJETIVO)
    .flatMap(([objetivo, lista]) => lista.map((b) => ({ ...b, objetivo: Number(objetivo) })));

  const SQL_120 = fs.readFileSync(`${RAIZ}supabase/migrations/120_semilla_enteros_1eso.sql`, "utf8");

  test("CADA ARQUETIPO DEL CÓDIGO EXISTE EN LA MIGRACIÓN, con ese nombre exacto", () => {
    // La costura que este archivo vigila. Si alguien renombra un arquetipo en
    // la base de datos, el generador sigue funcionando y la hoja sale igual
    // de bien — pero el nombre que imprime deja de corresponder a nada, y el
    // día que se cruce "lo que mandé" con "lo que el alumno falló" no habrá
    // por dónde unirlos.
    //
    // Leer un `.sql` con una expresión regular no es elegante; es la única
    // comprobación que detecta esto sin una base de datos delante.
    for (const bateria of TODAS) {
      const ejercicio = bateria.generador(crearAzar("catalogo"), { cuantos: bateria.minimo });
      assert.ok(ejercicio.arquetipo, `${bateria.generador.name} no declara arquetipo`);
      assert.ok(
        SQL_120.includes(`'${ejercicio.arquetipo}'`),
        `el arquetipo "${ejercicio.arquetipo}" (${bateria.generador.name}) no está en la migración 120`,
      );
    }
  });

  test("NINGÚN GENERADOR SE QUEDA FUERA del catálogo", () => {
    // Una batería escrita y no registrada es una batería que no sale en
    // ninguna hoja: funciona, tiene tests, y no la usa nadie. Es el olvido
    // más fácil de cometer al añadir la siguiente.
    const exportados = [
      ...Object.values(sumaResta), ...Object.values(producto),
      ...Object.values(potencias), ...Object.values(combinadas),
    ].filter((x) => typeof x === "function");
    const registrados = TODAS.map((b) => b.generador);
    const huerfanos = exportados.filter((g) => !registrados.includes(g));
    assert.deepEqual(huerfanos.map((g) => g.name), [], "generadores sin registrar");
    assert.equal(registrados.length, exportados.length, "hay registros de más");
  });

  test("ninguna batería está en dos objetivos a la vez", () => {
    const vistos = new Set();
    for (const b of TODAS) {
      assert.equal(vistos.has(b.generador), false, `${b.generador.name} está repetido`);
      vistos.add(b.generador);
    }
  });

  test("los rangos de apartados son coherentes y vienen del arquetipo", () => {
    for (const b of TODAS) {
      assert.ok(Number.isInteger(b.minimo) && b.minimo >= 2, `${b.generador.name}: mínimo ${b.minimo}`);
      assert.ok(b.maximo >= b.minimo, `${b.generador.name}: máximo ${b.maximo} < mínimo ${b.minimo}`);
      // Más de diez apartados en una batería es la "hoja de 100 ejercicios"
      // que Jorge pidió evitar desde el principio.
      assert.ok(b.maximo <= 10, `${b.generador.name}: ${b.maximo} apartados es demasiado`);
      assert.ok([1, 2, 3].includes(b.dificultad), `${b.generador.name}: dificultad ${b.dificultad}`);
    }
  });

  test("cada batería produce de verdad el mínimo de apartados que declara", () => {
    // Si el generador no llega a su mínimo, la instrucción del arquetipo no
    // se cumple: los cuatro casos de signos no caben en tres apartados.
    for (const b of TODAS) {
      for (const s of ["a", "b", 7, 42]) {
        const ej = b.generador(crearAzar(s), { cuantos: b.minimo });
        assert.ok(
          ej.apartados.length >= b.minimo,
          `${b.generador.name} con semilla ${s}: ${ej.apartados.length} de ${b.minimo}`,
        );
      }
    }
  });

  test("dentro de un objetivo, las baterías van de menos a más difícil", () => {
    // El orden de la tabla ES el orden de la hoja.
    for (const objetivo of OBJETIVOS) {
      const lista = BATERIAS_POR_OBJETIVO[objetivo];
      for (let i = 1; i < lista.length; i += 1) {
        assert.ok(
          lista[i].dificultad >= lista[i - 1].dificultad,
          `objetivo ${objetivo}: la batería ${i + 1} es más fácil que la anterior`,
        );
      }
    }
  });

  test("EL REPASO SE ORDENA PARA CALENTAR: lo fácil primero", () => {
    // La regresión. Ordenado por objetivo, para una hoja de operaciones
    // combinadas la primera batería de repaso era `paresConYSinParentesis`
    // —distinguir `(-3)^2` de `-3^2`, dificultad 3— antes de empezar. Un
    // calentamiento con lo más difícil del tema no calienta.
    const repaso = bateriasDeRepaso(6);
    assert.ok(repaso.length > 0);
    assert.equal(repaso[0].dificultad, 1, `empieza con dificultad ${repaso[0].dificultad}`);
    for (let i = 1; i < repaso.length; i += 1) {
      assert.ok(
        repaso[i].dificultad >= repaso[i - 1].dificultad,
        `el repaso baja de dificultad en el puesto ${i}`,
      );
    }
    // Y a igual dificultad, primero el objetivo más cercano: antes de las
    // combinadas se repasa multiplicar (objetivo 5) que sumar (objetivo 3).
    const faciles = repaso.filter((b) => b.dificultad === 1);
    assert.equal(faciles[0].objetivo, 5, `el primer repaso fácil es del objetivo ${faciles[0].objetivo}`);
  });

  test("el repaso son SIEMPRE objetivos anteriores, nunca el propio ni posteriores", () => {
    for (const objetivo of OBJETIVOS) {
      for (const b of bateriasDeRepaso(objetivo)) {
        assert.ok(b.objetivo < objetivo, `objetivo ${objetivo}: repaso del ${b.objetivo}`);
        assert.equal(b.esRepaso, true);
      }
      for (const b of bateriasPropias(objetivo)) {
        assert.equal(b.objetivo, objetivo);
        assert.equal(b.esRepaso, false);
      }
    }
  });

  test("los objetivos 1 y 2 están declarados aunque estén vacíos", () => {
    // Vacíos A PROPÓSITO: son "ordena de menor a mayor" y "sitúa en la
    // recta", que no son expresiones. Declararlos deja el hueco a la vista en
    // vez de que parezca que no existen.
    assert.deepEqual(BATERIAS_POR_OBJETIVO[1], []);
    assert.deepEqual(BATERIAS_POR_OBJETIVO[2], []);
    assert.deepEqual(OBJETIVOS, [1, 2, 3, 4, 5, 6]);
  });

  test("`bateriasParaObjetivo` pone el repaso delante", () => {
    const todas = bateriasParaObjetivo(6);
    const primerPropio = todas.findIndex((b) => !b.esRepaso);
    assert.ok(primerPropio > 0, "las propias tendrían que ir después del repaso");
    assert.equal(todas.slice(primerPropio).some((b) => b.esRepaso), false, "repaso mezclado al final");
    assert.equal(bateriasParaObjetivo(6, { conRepaso: false }).some((b) => b.esRepaso), false);
  });
}
