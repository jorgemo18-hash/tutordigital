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
  const { montaHoja, INTENSIDADES, ajustaALaZonaBuena, eligeBaterias } = await import(
    "../../server/lib/generadorEjercicios/montadorDeHoja.js"
  );
  const { BATERIAS_POR_OBJETIVO, bateriasPropias } = await import(
    "../../server/lib/generadorEjercicios/catalogoDeBaterias.js"
  );
  const { crearAzar } = await import("../../server/lib/generadorEjercicios/aleatorio.js");

  const CON_BATERIAS = [3, 4, 5, 6];
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

  test("NUNCA SALEN 5 NI 6 ACTIVIDADES: es la zona que gasta un folio", () => {
    // Medido con Chrome: 5 o 6 actividades sacan un segundo folio con 48 o
    // 92 mm de contenido. Una cara de papel por alumno para poner casi nada.
    for (const h of todas()) {
      const n = h.hoja.actividades.length;
      assert.equal(
        n === 5 || n === 6,
        false,
        `objetivo ${h.objetivo} ${h.intensidad}: ${n} actividades`,
      );
      assert.ok(n >= 1 && n <= 9, `${n} actividades`);
    }
  });

  test("el ajuste a la zona buena recorta hacia abajo, no hacia arriba", () => {
    assert.equal(ajustaALaZonaBuena(3), 3);
    assert.equal(ajustaALaZonaBuena(4), 4);
    assert.equal(ajustaALaZonaBuena(5), 4, "5 tiene que bajar a 4, no subir a 7");
    assert.equal(ajustaALaZonaBuena(6), 4);
    assert.equal(ajustaALaZonaBuena(7), 7);
    assert.equal(ajustaALaZonaBuena(9), 9);
    assert.equal(ajustaALaZonaBuena(12), 9, "el tope son 9: con 10 sale un tercer folio casi vacío");
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
      () => montaHoja({ objetivo: 1, azar: crearAzar("x") }),
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
