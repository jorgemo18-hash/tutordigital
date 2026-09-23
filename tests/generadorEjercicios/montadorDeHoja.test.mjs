// EL MONTADOR: de un objetivo a una hoja.
//
// Lo que se prueba aquí son las tres decisiones que toma y que un folio mal
// montado no perdona:
//
//   1. no caer en la zona mala de la paginación (5 o 6 actividades gastan una
//      cara de papel casi vacía por alumno);
//   2. no dejar fuera las baterías BASE del objetivo al recortar;
//   3. que las soluciones cuadren con los apartados impresos, porque de eso
//      depende poder corregir en papel después.
export async function run({ test, assert }) {
  const {
    montaHoja, INTENSIDADES, eligeBaterias, topeDeActividades, lasQueCaben,
  } = await import("../../server/lib/generadorEjercicios/montadorDeHoja.js");
  const { alturasDe, foliosEstimados, MINIMO_ULTIMO_FOLIO_MM } = await import(
    "../../server/lib/generadorEjercicios/alturaDeLaHoja.js"
  );
  const { BATERIAS_POR_OBJETIVO, bateriasPropias, TITULO_DE_OBJETIVO } = await import(
    "../../server/lib/generadorEjercicios/catalogoDeBaterias.js"
  );
  const { crearAzar } = await import("../../server/lib/generadorEjercicios/aleatorio.js");

  const CON_BATERIAS = [1, 2, 3, 4, 5, 6];
  const MODOS = Object.keys(INTENSIDADES);
  const SEMILLAS = ["a", "b", "c", 1, 42, 7777];

  const monta = (objetivo, intensidad, semilla = "s", extra = {}) => montaHoja({
    objetivo,
    intensidad,
    azar: crearAzar(`${objetivo}-${intensidad}-${semilla}`),
    cabecera: { materia: "Matemáticas", curso: "1.º ESO", objetivo: `objetivo ${objetivo}` },
    ...extra,
  });

  const todas = () => CON_BATERIAS.flatMap((o) => MODOS.flatMap(
    (m) => SEMILLAS.map((s) => ({ objetivo: o, intensidad: m, ...monta(o, m, s) })),
  ));

  test("LA HOJA CABE EN LOS FOLIOS QUE PIDE SU INTENSIDAD", () => {
    // SUSTITUYE A "nunca salen 5 ni 6 actividades", que era la regla vieja:
    // el montador contaba actividades y esquivaba a mano una zona mala
    // medida una vez. Fallaba por los dos lados en el papel — el objetivo 3
    // en refuerzo dejaba 35 mm en blanco y el 6 en normal sacaba un segundo
    // folio con solo el pie — porque un número de actividades no dice cuánto
    // ocupan: `subraya la preferente` mide 67 mm y `término que falta` 34.
    for (const h of todas()) {
      const { folios } = foliosEstimados(alturasDe(
        h.soluciones.map((x) => ({ clave: x.clave, objetivo: x.objetivo })),
        INTENSIDADES[h.intensidad].apartados,
      ));
      assert.ok(
        folios <= INTENSIDADES[h.intensidad].folios,
        `objetivo ${h.objetivo} ${h.intensidad}: ${folios} folios para una hoja de `
          + `${INTENSIDADES[h.intensidad].folios}`,
      );
    }
  });

  test("NO SE GASTA UN FOLIO PARA CUATRO EJERCICIOS", () => {
    // La regresión concreta: el objetivo 3 en refuerzo cabía en dos folios
    // con 64 mm en el segundo. Es legal —son dos folios y pedía dos— pero es
    // una cara de papel por alumno para cuatro ejercicios, y con una batería
    // menos cabe entero en uno.
    for (const h of todas()) {
      const { folios, usadoUltimoMm } = foliosEstimados(alturasDe(
        h.soluciones.map((x) => ({ clave: x.clave, objetivo: x.objetivo })),
        INTENSIDADES[h.intensidad].apartados,
      ));
      if (folios <= 1) continue;
      assert.ok(
        usadoUltimoMm >= MINIMO_ULTIMO_FOLIO_MM,
        `objetivo ${h.objetivo} ${h.intensidad}: el folio ${folios} lleva ${usadoUltimoMm} mm`,
      );
    }
  });

  test("`lasQueCaben` devuelve la hoja MÁS LLENA que entra, no la primera que entra", () => {
    // Con el objetivo 5 (seis baterías) y un solo folio en modo mínimo: si
    // devolviera la primera que cabe empezando por abajo, saldrían dos
    // actividades y medio folio en blanco.
    const propias = bateriasPropias(5);
    const cabenEnUno = lasQueCaben({ propias, repaso: [], tope: 6, folios: 1, modo: "minimo" });
    assert.ok(cabenEnUno.length >= 3, `solo ${cabenEnUno.length} actividades en un folio entero`);
    assert.equal(foliosEstimados(alturasDe(cabenEnUno, "minimo")).folios, 1);

    // Y una más ya no cabría: lo que devuelve es el máximo, no "unas cuantas".
    const unaMas = eligeBaterias({ propias, repaso: [], cuantas: cabenEnUno.length + 1 });
    if (unaMas.length > cabenEnUno.length) {
      assert.ok(
        foliosEstimados(alturasDe(unaMas, "minimo")).folios > 1,
        "cabía una actividad más y no se ha puesto",
      );
    }
  });

  test("con dos folios entran MÁS baterías que con uno", () => {
    // Con una lista larga (los objetivos 3 y 5 juntos, once baterías): con
    // las del objetivo 5 solas pasaba que seis no llenaban dos folios lo
    // bastante y la regla del folio gastado lo devolvía a uno, que es
    // correcto pero deja a este test sin nada que comparar.
    const propias = [...bateriasPropias(3), ...bateriasPropias(5)];
    const enUno = lasQueCaben({ propias, repaso: [], tope: propias.length, folios: 1, modo: "maximo" });
    const enDos = lasQueCaben({ propias, repaso: [], tope: propias.length, folios: 2, modo: "maximo" });
    assert.ok(enDos.length > enUno.length, `${enDos.length} en dos folios y ${enUno.length} en uno`);
  });

  test("AL RECORTAR NO SE PIERDE LA BASE DEL OBJETIVO", () => {
    // La regresión. Cogiendo las últimas de la lista, una hoja de repaso del
    // objetivo 3 se quedaba con resta, término que falta y cadena, y tiraba
    // `sumaMismoSigno` y `sumaDistintoSigno` — la base del objetivo. Una hoja
    // de sumar y restar enteros sin sumar dos del mismo signo no es una hoja
    // de ese objetivo.
    const propias = bateriasPropias(3);
    const primera = propias[0].generador;
    const ultima = propias[propias.length - 1].generador;

    for (const cuantas of [2, 3, 4, 5]) {
      const elegidas = eligeBaterias({ propias, repaso: [], cuantas });
      assert.equal(elegidas.length, Math.min(cuantas, propias.length));
      assert.equal(elegidas[0].generador, primera, `con ${cuantas} se pierde la primera`);
      assert.equal(
        elegidas[elegidas.length - 1].generador,
        ultima,
        `con ${cuantas} se pierde la última`,
      );
    }
  });

  test("y en la hoja de verdad tampoco: el objetivo 3 siempre suma del mismo signo", () => {
    for (const intensidad of MODOS) {
      for (const s of SEMILLAS) {
        const { soluciones } = monta(3, intensidad, s);
        assert.ok(
          soluciones.some((x) => x.clave === "suma_mismo_signo"),
          `${intensidad}: ${soluciones.map((x) => x.clave).join(", ")}`,
        );
      }
    }
  });

  test("las baterías PROPIAS del objetivo entran siempre, el repaso solo si falta sitio", () => {
    for (const h of todas()) {
      const propias = h.soluciones.filter((s) => !s.esRepaso);
      assert.ok(propias.length >= 1, `objetivo ${h.objetivo} ${h.intensidad}: ninguna propia`);
      // Si hay repaso, es porque las propias no llegaban al número pedido.
      const conRepaso = h.soluciones.filter((s) => s.esRepaso).length;
      if (conRepaso > 0) {
        assert.equal(
          propias.length,
          BATERIAS_POR_OBJETIVO[h.objetivo].length,
          `objetivo ${h.objetivo} ${h.intensidad}: hay repaso sin usar todas las propias`,
        );
      }
    }
  });

  test("UNA HOJA DE REFUERZO ES MAYORÍA DEL OBJETIVO QUE PIDES, no del repaso", () => {
    // La regresión, y la peor de todas porque la hoja salía bien impresa.
    //
    // El objetivo 6 tiene 3 baterías propias. Refuerzo pedía 8, y las 5 que
    // faltaban se rellenaban con repaso: una hoja "de operaciones
    // combinadas" con 5 actividades de sumar, multiplicar y potencias.
    //
    // Así es como lo separan los cuadernos de los libros de texto: la ficha
    // de refuerzo de un contenido es de ese contenido (sube el andamiaje, no
    // la variedad de temas) y el repaso acumulativo es OTRA ficha.
    for (const h of todas()) {
      const deRepaso = h.soluciones.filter((s) => s.esRepaso).length;
      const propias = h.soluciones.length - deRepaso;
      assert.ok(
        deRepaso <= propias,
        `objetivo ${h.objetivo} ${h.intensidad}: ${deRepaso} de repaso y solo ${propias} propias`
          + ` (${h.soluciones.map((s) => `${s.clave}${s.esRepaso ? "*" : ""}`).join(", ")})`,
      );
      // El 2 va LITERAL a propósito: mi primera versión comparaba con
      // `TOPE_DE_REPASO` importado, o sea que la comprobación seguía pasando
      // al subir el tope. Un test que importa el número que vigila no vigila
      // nada.
      assert.ok(
        deRepaso <= 2,
        `objetivo ${h.objetivo} ${h.intensidad}: ${deRepaso} actividades de repaso`,
      );
    }
  });

  test("el caso concreto: refuerzo del objetivo 6 lleva sus TRES baterías propias", () => {
    // El número exacto, porque el test de arriba se cumpliría también con una
    // hoja de 2 propias + 2 de repaso, que sigue siendo peor hoja.
    const { soluciones } = monta(6, "refuerzo");
    const propias = soluciones.filter((s) => !s.esRepaso);
    assert.equal(propias.length, 3, soluciones.map((s) => s.clave).join(", "));
    assert.ok(soluciones.length <= 5, "3 propias y como mucho 2 de calentamiento");
  });

  test("AL RECORTAR POR ALTURA SE CAE EL CALENTAMIENTO, no una batería del objetivo", () => {
    // Si la hoja no cabe y hay que quitar una actividad, lo que sobra es el
    // repaso: quitando una propia, la hoja perdería contenido del objetivo
    // que se pidió para dejar contenido de otro.
    assert.equal(topeDeActividades({ propias: 3, repaso: 12, pedidas: 8 }), 5);
    const conCinco = eligeBaterias({
      propias: [{ generador: "p1" }, { generador: "p2" }, { generador: "p3" }],
      repaso: [{ generador: "r1" }, { generador: "r2" }],
      cuantas: 5,
    });
    assert.deepEqual(conCinco.map((b) => b.generador), ["r1", "r2", "p1", "p2", "p3"]);

    const conCuatro = eligeBaterias({
      propias: [{ generador: "p1" }, { generador: "p2" }, { generador: "p3" }],
      repaso: [{ generador: "r1" }, { generador: "r2" }],
      cuantas: 4,
    });
    assert.deepEqual(
      conCuatro.map((b) => b.generador), ["r1", "p1", "p2", "p3"],
      "al bajar de 5 a 4 tiene que caer una de repaso, no una propia",
    );
  });

  test("el tope no deja al repaso pasar de las propias ni de dos", () => {
    assert.equal(topeDeActividades({ propias: 1, repaso: 9, pedidas: 8 }), 2, "1 propia admite 1 de repaso");
    assert.equal(topeDeActividades({ propias: 6, repaso: 6, pedidas: 8 }), 8, "6 propias + el tope de 2");
    assert.equal(topeDeActividades({ propias: 5, repaso: 0, pedidas: 8 }), 5, "sin repaso, solo las propias");
    assert.equal(topeDeActividades({ propias: 6, repaso: 6, pedidas: 3 }), 3, "no se pide más de lo pedido");
  });

  test("el repaso va DELANTE y es de objetivos anteriores", () => {
    for (const h of todas()) {
      const claves = h.soluciones;
      const primeroPropio = claves.findIndex((s) => !s.esRepaso);
      assert.ok(primeroPropio >= 0);
      for (const s of claves.slice(primeroPropio)) {
        assert.equal(s.esRepaso, false, `objetivo ${h.objetivo}: repaso después de las propias`);
      }
      for (const s of claves.slice(0, primeroPropio)) {
        assert.ok(s.objetivo < h.objetivo, `repaso del objetivo ${s.objetivo}`);
      }
    }
  });

  test("LAS SOLUCIONES CUADRAN CON LOS APARTADOS IMPRESOS", () => {
    // De esto depende poder corregir en papel: si se desalinearan, "hoja X,
    // hueco 4, mal" apuntaría a otro ejercicio.
    for (const h of todas()) {
      assert.equal(h.soluciones.length, h.hoja.actividades.length);
      h.hoja.actividades.forEach((actividad, i) => {
        assert.equal(h.soluciones[i].orden, i + 1, "el orden no es el de la actividad");
        assert.equal(
          h.soluciones[i].soluciones.length,
          actividad.apartados.length,
          `objetivo ${h.objetivo} ${h.intensidad}, actividad ${i + 1}: `
            + `${h.soluciones[i].soluciones.length} soluciones para ${actividad.apartados.length} apartados`,
        );
      });
    }
  });

  test("cada batería lleva los apartados de su arquetipo, ni más ni menos", () => {
    // El ejemplo resuelto es un apartado DE MÁS, así que lo impreso es el
    // rango del arquetipo más uno.
    const rangoDe = (clave, objetivo) => {
      const todos = Object.values(BATERIAS_POR_OBJETIVO).flat();
      const encontrada = todos.find((b) => {
        const ej = b.generador(crearAzar("rango"), { cuantos: b.minimo });
        return ej.clave === clave;
      });
      void objetivo;
      return encontrada;
    };
    for (const h of todas()) {
      h.hoja.actividades.forEach((actividad, i) => {
        const bateria = rangoDe(h.soluciones[i].clave, h.soluciones[i].objetivo);
        assert.ok(bateria, `sin rango para ${h.soluciones[i].clave}`);
        assert.ok(
          actividad.apartados.length >= bateria.minimo,
          `${h.soluciones[i].clave}: ${actividad.apartados.length} apartados, mínimo ${bateria.minimo}`,
        );
        assert.ok(
          actividad.apartados.length <= bateria.maximo + 1,
          `${h.soluciones[i].clave}: ${actividad.apartados.length} apartados, máximo ${bateria.maximo} + ejemplo`,
        );
      });
    }
  });

  test("refuerzo pone MÁS APARTADOS POR BATERÍA que repaso", () => {
    // Jorge: *"si lo lleva muy mal, bastantes ejercicios; si solo falla a
    // veces, menos"*.
    //
    // LA COMPARACIÓN TIENE QUE SER POR BATERÍA, y mi primera versión comparaba
    // el total de apartados de la hoja. Eso no distinguía nada: refuerzo pone
    // 8 actividades y repaso 3, así que el total sale mayor aunque a cada
    // batería se le pidiera el MÍNIMO. Lo comprobé poniendo "minimo" en
    // refuerzo y el test seguía pasando.
    //
    // El objetivo 4 sin repaso da UNA actividad en las tres intensidades, así
    // que ahí se compara la misma batería consigo misma.
    const apartadosDeLaUnica = (intensidad) => {
      const { hoja } = monta(4, intensidad, "s", { conRepaso: false });
      assert.equal(hoja.actividades.length, 1, "este test necesita una sola batería");
      return hoja.actividades[0].apartados.length;
    };
    const repaso = apartadosDeLaUnica("repaso");
    const normal = apartadosDeLaUnica("normal");
    const refuerzo = apartadosDeLaUnica("refuerzo");
    assert.ok(refuerzo > repaso, `refuerzo ${refuerzo} apartados, repaso ${repaso}`);
    assert.ok(normal >= repaso, `normal ${normal}, repaso ${repaso}`);
    assert.ok(refuerzo >= normal, `refuerzo ${refuerzo}, normal ${normal}`);

    // Y la hoja entera también crece, que es lo que el profesor ve.
    for (const objetivo of CON_BATERIAS) {
      const total = (intensidad) => monta(objetivo, intensidad)
        .hoja.actividades.reduce((n, a) => n + a.apartados.length, 0);
      assert.ok(total("refuerzo") > total("repaso"), `objetivo ${objetivo}`);
    }
  });

  test("LOS BLOQUES TITULAN EL CAMBIO DE TEMA, y la numeración no se reinicia", () => {
    // Jorge, mirando una hoja de dos folios: quería ver dónde cambia de tema.
    // Lo que NO se hace es reiniciar la numeración en cada bloque: con dos
    // "actividad 1" en el mismo papel, "hoja X, actividad 1, apartado c" deja
    // de señalar a un solo ejercicio y el registro de fallos se rompe.
    for (const h of todas()) {
      const objetivos = h.soluciones.map((s) => s.objetivo);
      const bloques = h.hoja.actividades.map((a) => a.bloque || null);

      if (new Set(objetivos).size < 2) {
        assert.deepEqual(
          bloques.filter(Boolean), [],
          `objetivo ${h.objetivo} ${h.intensidad}: un solo tema y aun así titula bloques`,
        );
      } else {
        // Título exactamente donde cambia el objetivo, y en ningún otro sitio.
        objetivos.forEach((objetivo, i) => {
          const cambia = i === 0 || objetivo !== objetivos[i - 1];
          assert.equal(
            Boolean(bloques[i]), cambia,
            `objetivo ${h.objetivo} ${h.intensidad}, actividad ${i + 1}: `
              + `título ${bloques[i] ? "puesto" : "ausente"} y el tema ${cambia ? "cambia" : "sigue"}`,
          );
        });
      }

      // La numeración es la de la hoja entera, pase lo que pase con los
      // bloques. `orden` es lo único que une el papel con el registro.
      h.soluciones.forEach((s, i) => assert.equal(s.orden, i + 1));
    }
  });

  test("el título del bloque es el del objetivo de esas actividades", () => {
    // En cualquier hoja con calentamiento, cada bloque va titulado con SU
    // objetivo, no con el de la hoja. Se buscan entre todas las hojas del
    // barrido en vez de fijar una: qué hoja lleva calentamiento depende de
    // las alturas medidas, y la primera versión de este test se rompió al
    // corregirlas sin que hubiera cambiado nada de lo que prueba.
    const conBloques = todas().filter((h) => new Set(h.soluciones.map((x) => x.objetivo)).size > 1);
    assert.ok(conBloques.length > 0, "ninguna hoja del barrido lleva calentamiento: el test no prueba nada");
    for (const { hoja, soluciones } of conBloques) {
      hoja.actividades.forEach((a, i) => {
        if (a.bloque) assert.equal(a.bloque, TITULO_DE_OBJETIVO[soluciones[i].objetivo]);
      });
    }
  });

  test("la misma semilla da la MISMA hoja", () => {
    // Sin esto no se puede reimprimir la hoja de un alumno ni reproducir un
    // fallo: cada vista previa saldría distinta.
    for (const objetivo of CON_BATERIAS) {
      const a = monta(objetivo, "normal", "igual");
      const b = monta(objetivo, "normal", "igual");
      assert.deepEqual(a.hoja, b.hoja);
      assert.deepEqual(a.soluciones, b.soluciones);
    }
  });

  test("la hoja NO lleva bloque de ejemplo global", () => {
    // Desde que cada actividad lleva su apartado resuelto, uno arriba era
    // duplicar y se comía los 35 mm más valiosos del folio.
    for (const h of todas()) {
      assert.deepEqual(h.hoja.ejemplos, []);
    }
  });

  test("`esencial` viene de fuera: no se inventa una teoría", () => {
    const sin = monta(5, "normal");
    assert.equal(sin.hoja.esencial, undefined, "sin teoría, la hoja sale sin la caja");

    const esencial = { titulo: "Lo esencial", parrafos: ["La regla de los signos."] };
    const con = monta(5, "normal", "s", { esencial });
    assert.deepEqual(con.hoja.esencial, esencial);
  });

  test("un objetivo sin baterías y una intensidad inventada revientan, no salen vacíos", () => {
    // Una hoja vacía impresa es peor que un error: el profesor la reparte.
    assert.throws(
      // El 7 no existe: desde que el 1 y el 2 tienen baterías, no queda
      // ningún objetivo real vacío con el que probarlo.
      () => montaHoja({ objetivo: 7, azar: crearAzar("x") }),
      /no tiene ninguna batería/,
    );
    assert.throws(
      () => montaHoja({ objetivo: 5, azar: crearAzar("x"), intensidad: "brutal" }),
      /intensidad desconocida/,
    );
    assert.throws(() => montaHoja({ objetivo: 5 }), /azar/);
  });

  test("sin repaso, el objetivo 4 sale con su única batería y no revienta", () => {
    const { hoja, soluciones } = monta(4, "refuerzo", "s", { conRepaso: false });
    assert.equal(hoja.actividades.length, 1);
    assert.equal(soluciones[0].clave, "elimina_parentesis");
    assert.equal(soluciones[0].esRepaso, false);
  });
}
