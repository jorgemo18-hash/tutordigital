// EL TEMA FUNCIONES Y GRÁFICAS: cada respuesta comprobada contra LA FIGURA
// (los puntos y la poligonal que se dibujan) o contra el texto impreso,
// evaluando aquí las expresiones. Una gráfica que no dice lo mismo que la
// solución sería un ejercicio imposible en papel.
export async function run({ test, assert }) {
  const coo = await import("../../server/lib/generadorEjercicios/generadores/funciones/coordenadas.js");
  const tab = await import("../../server/lib/generadorEjercicios/generadores/funciones/tablas.js");
  const gra = await import("../../server/lib/generadorEjercicios/generadores/funciones/graficas.js");
  const pro = await import("../../server/lib/generadorEjercicios/generadores/funciones/problemas.js");
  const { crearAzar } = await import("../../server/lib/generadorEjercicios/aleatorio.js");
  const { trampasDelApartado } = await import("../../server/lib/generadorEjercicios/errores/trampasDelApartado.js");
  const { montaHoja, INTENSIDADES } = await import("../../server/lib/generadorEjercicios/montadorDeHoja.js");
  const { objetivosDe } = await import("../../server/lib/generadorEjercicios/catalogoDeBaterias.js");
  const { FUNCIONES_1ESO } = await import("../../server/lib/generadorEjercicios/temas/funciones1eso.js");
  const { Window } = await import("happy-dom");
  const { buildFigura } = await import("../../assets/shared/hoja/js/figuras/index.js");

  const SEMILLAS = Array.from({ length: 40 }, (_, i) => `fu${i}`);
  const todos = (gen, cuantos) => SEMILLAS.flatMap((s) => gen(crearAzar(s), { cuantos }).apartados);
  const num = (t) => Number(String(t).replace("−", "-"));
  const par = (t) => t.replace(/[()]/g, "").split(", ").map(num);
  // "−3x + 1" → función de x.
  const f = (e) => new Function("x", `return ${e.replace(/−/g, "-").replace(/(\d)x/g, "$1*x")};`);
  // La poligonal: y en una x (interpolando entre vértices).
  function yEn(puntos, x) {
    for (let i = 1; i < puntos.length; i += 1) {
      const [[x0, y0], [x1, y1]] = [puntos[i - 1], puntos[i]];
      if (x >= x0 && x <= x1) return y0 + ((y1 - y0) * (x - x0)) / (x1 - x0);
    }
    return null;
  }

  test("funciones/coordenadas: las de los puntos dibujados, en orden (x, y)", () => {
    for (const a of todos(coo.leeCoordenadas, 3)) {
      assert.deepEqual(a.solucion.map(par), a.figura.puntos.map((p) => [p.x, p.y]));
      const cuadrantes = new Set(a.figura.puntos.map((p) => `${Math.sign(p.x)}${Math.sign(p.y)}`));
      assert.equal(cuadrantes.size, 3, "cada punto en un cuadrante distinto");
      assert.ok(a.figura.puntos.every((p) => Math.abs(p.x) !== Math.abs(p.y)), "al revés no puede ser el mismo punto");
      assert.ok(a.figura.puntos.every((p) => Math.abs(p.x) < 4 && Math.abs(p.y) < 3), "dentro de la cuadrícula, no en el borde");
    }
    for (const a of todos(coo.cuadrante, 8)) {
      const [x, y] = par(a.texto.replace(": ___", ""));
      const esperado = x === 0 ? "eje Y" : y === 0 ? "eje X" : x > 0 ? (y > 0 ? "1.º" : "4.º") : (y > 0 ? "2.º" : "3.º");
      assert.equal(a.solucion, esperado, a.texto);
    }
  });

  test("funciones/tablas: la tabla es la expresión evaluada, y la expresión reproduce la tabla", () => {
    for (const a of todos(tab.completaTablaFuncion, 3)) {
      const [, e, xs] = a.texto.match(/^y = (.+); x: (.+) → y: ___$/);
      assert.deepEqual(a.solucion.map(num), xs.split(", ").map(num).map(f(e)), a.texto);
    }
    for (const a of todos(tab.tablaAExpresion, 3)) {
      const [, xs, ys] = a.texto.match(/^x: (.+) \| y: (.+) → y = ___$/);
      const g = f(a.solucion);
      xs.split(", ").map(num).forEach((x, i) => assert.equal(g(x), num(ys.split(", ")[i]), `${a.texto} → ${a.solucion}`));
    }
  });

  test("funciones/de la gráfica a la expresión: la expresión pasa por los puntos dibujados", () => {
    for (const a of todos(gra.graficaAExpresion, 3)) {
      const g = f(a.solucion);
      // (+ 0: que −2 · 0 = −0 no cuente como distinto de 0.)
      a.figura.puntos.forEach((p) => assert.equal(g(p.x) + 0, p.y, a.solucion));
      a.figura.lineas[0].forEach(([x, y]) => assert.equal(g(x) + 0, y));
      assert.deepEqual([a.figura.x, a.figura.y], [[-1, 4], [-4, 4]], "siempre la misma cuadrícula");
    }
  });

  test("funciones/leer la gráfica: cada respuesta sale de la poligonal dibujada", () => {
    for (const a of todos(gra.leeGrafica, 2)) {
      const p = a.figura.lineas[0];
      const [r1, r2, r3] = a.solucion.map((s) => num(s.split(" ")[0]));
      const horizontal = p.findIndex((q, i) => i > 0 && q[1] === p[i - 1][1]);
      const dur = p[horizontal][0] - p[horizontal - 1][0];
      assert.equal(a.figura.y[1], 7 * a.figura.pasoY, "siete cuadros de alto siempre");
      // Todos los vértices, en cruces de la cuadrícula.
      p.forEach(([x, y]) => { assert.equal(x % (a.figura.pasoX || 1), 0); assert.equal(y % a.figura.pasoY, 0); });
      if (a.contexto === "bici") {
        const t = num(a.texto.match(/a las (\d+) h/)[1]);
        assert.equal(r1, yEn(p, t));
        assert.equal(r2, dur);
        assert.equal(r3, p.slice(1).reduce((s, q, i) => s + Math.abs(q[1] - p[i][1]), 0));
      } else if (a.contexto === "deposito") {
        assert.equal(r1, Math.max(...p.map((q) => q[1])));
        assert.equal(r2, dur);
        const [llenar, vaciar] = [p[1][0] - p[0][0], p[3][0] - p[2][0]];
        assert.equal(a.solucion[2], llenar > vaciar ? "en llenarse" : "en vaciarse");
      } else if (a.contexto === "temperatura") {
        assert.equal(r1, p[0][1]);
        assert.equal(r2, Math.max(...p.map((q) => q[1])));
        assert.equal(r3, dur);
      } else {
        assert.equal(r1, p[horizontal][1]);
        assert.equal(r2, dur);
        assert.equal(r3, p[p.length - 1][0]);
        assert.equal(p[p.length - 1][1], 0, "vuelve a casa");
      }
    }
  });

  test("funciones/problemas: la expresión y el valor, desde el enunciado", () => {
    for (const a of todos(pro.problemasFuncionLineal, 3)) {
      const n = (a.texto.match(/\d+/g) || []).map(Number);
      const [e, v] = a.solucion;
      const g = f(e.replace("y = ", ""));
      const x = n[n.length - 1];
      assert.equal(num(v.split(" ")[0]), g(x), a.texto);
      // Lo fijo es lo que vale y para x = 0 y aparece en el enunciado.
      assert.ok(n.includes(g(0)), `${a.texto}: la parte fija no está en el enunciado`);
    }
    for (const a of todos(pro.comparaTarifas, 3)) {
      const [fa, pa, fb, pb, n] = (a.texto.match(/\d+/g) || []).map(Number);
      assert.equal(a.solucion, fa + pa * n < fb + pb * n ? "A" : "B", a.texto);
      assert.notEqual(a.solucion, fa < fb ? "A" : "B", "comparar lo fijo no puede acertar");
    }
  });

  test("funciones/respuestas-trampa: cada error da lo que escribiría el alumno", () => {
    const t = (clave, ap) => Object.fromEntries(trampasDelApartado(clave, ap).map((x) => [x.error, x.respuesta]));
    assert.deepEqual(t("lee_coordenadas", { solucion: ["(3, −2)"], alReves: ["(−2, 3)"] }), { 1: "(−2, 3)" });
    assert.deepEqual(t("cuadrante", { solucion: "2.º", alReves: "4.º" }), { 2: "4.º" });
    assert.deepEqual(t("completa_tabla_funcion", { solucion: ["−3", "−1"], sinSigno: ["5", "3"] }), { 3: "5, 3" });
    assert.deepEqual(t("tabla_a_expresion", { solucion: "3x + 1", cambiada: "x + 3" }), { 4: "x + 3" });
    assert.deepEqual(t("compara_tarifas", { solucion: "B", soloLoFijo: "A" }), { 5: "A" });
  });

  test("funciones/las figuras se pueden dibujar y todo apartado trae su razón", () => {
    const w = globalThis.window || new Window();
    for (const b of Object.values(FUNCIONES_1ESO.baterias).flat()) {
      for (const a of todos(b.generador, b.maximo)) {
        assert.ok(a.razon && a.razon.length > 10, `${b.clave}: sin razón`);
        for (const campo of [a.latex, a.latexResuelto, a.texto, a.razon]) assert.ok(!/undefined|NaN|\[object|null|\+ −|\+ -\d|1x/.test(campo), `${b.clave}: ${campo}`);
        if (a.figura) assert.ok(buildFigura(a.figura, w.document), `${b.clave}: la figura no se puede dibujar`);
      }
    }
  });

  test("funciones/el montador arma una hoja de cada objetivo en las tres intensidades", () => {
    for (const objetivo of objetivosDe(FUNCIONES_1ESO)) {
      for (const intensidad of Object.keys(INTENSIDADES)) {
        const { hoja, soluciones } = montaHoja({ tema: FUNCIONES_1ESO, objetivo, intensidad, azar: crearAzar(`${objetivo}${intensidad}`) });
        assert.ok(hoja.actividades.length >= 2, `objetivo ${objetivo} ${intensidad}: ${hoja.actividades.length} actividad`);
        soluciones.forEach((s, i) => assert.equal(s.respuestas.length, hoja.actividades[i].apartados.length));
      }
    }
  });
}
