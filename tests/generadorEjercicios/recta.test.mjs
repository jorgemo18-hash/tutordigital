// LAS BATERÍAS DE LA RECTA NUMÉRICA (generadores/recta.js).
//
// El dibujo se prueba en tests/hoja/rectaNumerica.test.mjs; aquí, que el DATO
// de cada recta sea un ejercicio que se puede hacer y que enseña lo que tiene
// que enseñar.
export async function run({ test, assert }) {
  const recta = await import("../../server/lib/generadorEjercicios/generadores/recta.js");
  const { crearAzar } = await import("../../server/lib/generadorEjercicios/aleatorio.js");
  const { marcasDe } = await import("../../assets/shared/hoja/js/rectaNumerica.js");
  const { conEjemploResuelto } = await import("../../server/lib/generadorEjercicios/ejemploResuelto.js");
  const { aActividadDeHoja } = await import("../../server/lib/generadorEjercicios/ejercicio.js");

  const GENERADORES = [
    recta.representaEnRecta, recta.representaEnRectaGraduada,
    recta.leeLaRecta, recta.leeLaRectaGraduada,
  ];
  const SEMILLAS = Array.from({ length: 40 }, (_, i) => `recta-${i}`);
  const cadaApartado = (fn) => {
    for (const g of GENERADORES) {
      for (const s of SEMILLAS) {
        for (const a of g(crearAzar(s), { cuantos: 3 }).apartados) fn(a, g);
      }
    }
  };

  test("cada recta se puede dibujar y cada número cae en una marca", () => {
    cadaApartado((a, g) => {
      const marcas = marcasDe(a.figura);
      assert.ok(marcas, `${g.name}: recta que no se puede dibujar`);
      for (const v of a.solucion) assert.ok(marcas.includes(v), `${g.name}: ${v} no está en la recta`);
      for (const p of a.figura.puntos) assert.ok(marcas.includes(p.valor));
    });
  });

  test("NINGÚN NÚMERO PEDIDO ESTÁ YA ESCRITO en la recta", () => {
    // Colocar o leer el 0 o el 1 cuando ya vienen rotulados no es ejercicio.
    cadaApartado((a, g) => {
      for (const v of a.solucion) {
        assert.ok(!a.figura.rotulos.includes(v), `${g.name}: pide el ${v}, que ya está rotulado`);
      }
    });
  });

  test("al menos dos negativos y un positivo en cada recta, sin repetidos", () => {
    cadaApartado((a, g) => {
      assert.ok(a.solucion.filter((v) => v < 0).length >= 2, `${g.name}: menos de dos negativos`);
      assert.ok(a.solucion.some((v) => v > 0), `${g.name}: ningún positivo`);
      assert.equal(new Set(a.solucion).size, a.solucion.length, `${g.name}: números repetidos`);
    });
  });

  test("la graduada va rotulada en el 0 y en la PRIMERA marca, nada más", () => {
    // Si se rotularan más, no haría falta deducir cuánto vale cada marca, que
    // es todo el ejercicio.
    for (const g of [recta.representaEnRectaGraduada, recta.leeLaRectaGraduada]) {
      for (const s of SEMILLAS) {
        for (const a of g(crearAzar(s), { cuantos: 3 }).apartados) {
          assert.ok([2, 5, 10].includes(a.figura.paso));
          assert.deepEqual(a.figura.rotulos, [0, a.figura.paso]);
        }
      }
    }
  });

  test("EN UNA BATERÍA GRADUADA CADA RECTA LLEVA UN PASO DISTINTO", () => {
    // Si las tres fueran de 5 en 5, a la segunda ya no se mira la marca.
    for (const g of [recta.representaEnRectaGraduada, recta.leeLaRectaGraduada]) {
      for (const s of SEMILLAS) {
        const pasos = g(crearAzar(s), { cuantos: 3 }).apartados.map((a) => a.figura.paso);
        assert.equal(new Set(pasos).size, 3, `${g.name} ${s}: pasos ${pasos}`);
      }
    }
  });

  test("LAS LETRAS NO VAN SIEMPRE DE IZQUIERDA A DERECHA", () => {
    // Si A fuera siempre el de más a la izquierda, bastaría con ordenar.
    let desordenadas = 0;
    let total = 0;
    for (const s of SEMILLAS) {
      for (const a of recta.leeLaRecta(crearAzar(s), { cuantos: 3 }).apartados) {
        total += 1;
        const v = a.figura.puntos.map((p) => p.valor);
        if (v.some((x, i) => i > 0 && x < v[i - 1])) desordenadas += 1;
      }
    }
    assert.ok(desordenadas > total * 0.8, `solo ${desordenadas} de ${total} desordenadas`);
  });

  test("leer: la solución es el valor de cada letra, en orden A, B, C, D", () => {
    const a = recta.leeLaRecta(crearAzar("orden"), { cuantos: 2 }).apartados[0];
    assert.deepEqual(a.figura.puntos.map((p) => p.etiqueta), ["A", "B", "C", "D"]);
    assert.deepEqual(a.solucion, a.figura.puntos.map((p) => p.valor));
    assert.equal((a.latex.match(/_{3,}/g) || []).length, 4);
  });

  test("EL EJEMPLO DE REPRESENTAR LLEVA LOS PUNTOS PUESTOS; la práctica, la recta vacía", () => {
    const ej = conEjemploResuelto(recta.representaEnRecta, crearAzar("ejemplo"), { cuantos: 2 });
    const act = aActividadDeHoja(ej);
    const [ejemplo, ...practica] = act.apartados;
    assert.equal(ejemplo.resuelto, true);
    assert.equal(ejemplo.figura.puntos.length, 5);
    assert.ok(ejemplo.explicacion.includes("marca"));
    for (const p of practica) {
      assert.equal(typeof p, "object", "un apartado con recta baja como objeto");
      assert.deepEqual(p.figura.puntos, []);
    }
  });

  test("el ejemplo de leer lleva las respuestas escritas y sin huecos", () => {
    const ej = conEjemploResuelto(recta.leeLaRectaGraduada, crearAzar("ejemplo"), { cuantos: 2 });
    const [ejemplo] = aActividadDeHoja(ej).apartados;
    assert.ok(!/_{3,}/.test(ejemplo.texto), ejemplo.texto);
    assert.ok(/Cada marca vale (2|5|10)/.test(ejemplo.explicacion), ejemplo.explicacion);
  });
}
