// EL TEMA GEOMETRÍA PLANA: cada respuesta comprobada contra LA FIGURA, no
// contra el enunciado. El área se calcula aquí con la fórmula del zapatero
// sobre los vértices del dibujo; los ángulos, midiendo los segmentos; y las
// cotas se comparan con las longitudes de verdad. Así se caza un dibujo que
// no dice lo mismo que la solución, que en papel sería un ejercicio
// imposible.
export async function run({ test, assert }) {
  const ang = await import("../../server/lib/generadorEjercicios/generadores/geometria/angulos.js");
  const cla = await import("../../server/lib/generadorEjercicios/generadores/geometria/clasificacion.js");
  const are = await import("../../server/lib/generadorEjercicios/generadores/geometria/areas.js");
  const cir = await import("../../server/lib/generadorEjercicios/generadores/geometria/circulo.js");
  const com = await import("../../server/lib/generadorEjercicios/generadores/geometria/compuestas.js");
  const { crearAzar } = await import("../../server/lib/generadorEjercicios/aleatorio.js");
  const { trampasDelApartado } = await import("../../server/lib/generadorEjercicios/errores/trampasDelApartado.js");
  const { montaHoja, INTENSIDADES } = await import("../../server/lib/generadorEjercicios/montadorDeHoja.js");
  const { objetivosDe } = await import("../../server/lib/generadorEjercicios/catalogoDeBaterias.js");
  const { GEOMETRIA_1ESO } = await import("../../server/lib/generadorEjercicios/temas/geometria1eso.js");

  const SEMILLAS = Array.from({ length: 40 }, (_, i) => `ge${i}`);
  const todos = (gen, cuantos) => SEMILLAS.flatMap((s) => gen(crearAzar(s), { cuantos }).apartados);
  const n = (t) => Number(String(t).replace(/[^\d,.-]/g, "").replace(",", "."));
  const elementos = (a, clave) => a.figura.elementos.filter((e) => e[clave]).map((e) => e[clave]);
  const zapatero = (v) => Math.abs(v.reduce((s, [x, y], i) => { const [x2, y2] = v[(i + 1) % v.length]; return s + x * y2 - x2 * y; }, 0)) / 2;
  const dist = (p, q) => Math.hypot(p[0] - q[0], p[1] - q[1]);
  const anguloEn = (v, p, q) => {
    const a = Math.atan2(p[1] - v[1], p[0] - v[0]);
    const b = Math.atan2(q[1] - v[1], q[0] - v[0]);
    let d = Math.abs(a - b) * (180 / Math.PI);
    if (d > 180) d = 360 - d;
    return d;
  };
  // Cada cota dice la longitud de verdad del segmento que acota.
  const cotasCiertas = (a) => elementos(a, "cota").every((c) => Math.abs(dist(c.de, c.a) - n(c.texto)) < 0.5);

  test("geometría/el ángulo dibujado mide lo que dice la solución, a escala real", () => {
    for (const gen of [ang.mideAngulo, ang.clasificaAngulo]) {
      for (const a of todos(gen, 6)) {
        assert.equal(a.figura.escala, "real");
        const [s1, s2] = elementos(a, "segmento");
        const g = anguloEn(s1[0], s1[1], s2[1]);
        const esperado = gen === ang.mideAngulo ? n(a.solucion)
          : { agudo: [1, 89], recto: [90, 90], obtuso: [91, 179], llano: [180, 180] }[a.solucion];
        if (Array.isArray(esperado)) assert.ok(g >= esperado[0] - 0.01 && g <= esperado[1] + 0.01, `${a.solucion}: ${g}°`);
        else assert.ok(Math.abs(g - esperado) < 0.01, `${a.solucion}: ${g}°`);
        // Para medir, lados de 28 mm (caben bajo el transportador); para
        // clasificar, de 18.
        assert.ok(Math.abs(dist(...s1) - (gen === ang.mideAngulo ? 28 : 18)) < 0.01);
      }
    }
  });

  test("geometría/clasificar ángulos: nada cerca de 90° ni de 180° (se clasifica mirando)", () => {
    for (const a of todos(ang.clasificaAngulo, 6)) {
      const g = n(a.texto.match(/de (\d+)°/)[1]);
      assert.ok(g === 90 || g === 180 || Math.abs(g - 90) >= 15, `${g}°`);
    }
  });

  test("geometría/el ángulo que falta: el del dibujo, y los tres suman 180°", () => {
    for (const a of todos(ang.anguloDelTriangulo, 4)) {
      const [v] = elementos(a, "poligono");
      const angs = v.map((p, i) => anguloEn(p, v[(i + 1) % 3], v[(i + 2) % 3]));
      const rot = elementos(a, "angulo").map((x) => x.texto);
      const i = rot.indexOf("x");
      assert.ok(Math.abs(angs[i] - n(a.solucion)) < 0.01, `${a.solucion} y en el dibujo ${angs[i]}`);
      rot.forEach((r, j) => { if (j !== i) assert.ok(Math.abs(angs[j] - n(r)) < 0.01, `${r} rotulado, ${angs[j]} dibujado`); });
    }
    for (const a of todos(ang.complementarioSuplementario, 8)) {
      const g = n(a.texto.match(/de (\d+)°/)[1]);
      assert.equal(n(a.solucion) + g, /complementario/.test(a.texto) ? 90 : 180, a.texto);
    }
  });

  test("geometría/clasificar triángulos: la clase sale de las medidas del dibujo", () => {
    for (const a of todos(cla.clasificaTriangulo, 6)) {
      const [v] = elementos(a, "poligono");
      if (/lados/.test(a.latex)) {
        assert.ok(cotasCiertas(a), a.texto);
        const l = [dist(v[0], v[1]), dist(v[1], v[2]), dist(v[2], v[0])].map((x) => Math.round(x * 100) / 100);
        const iguales = new Set(l).size;
        assert.equal(a.solucion, { 1: "equilátero", 2: "isósceles", 3: "escaleno" }[iguales], `${l}`);
      } else {
        const m = Math.max(...v.map((p, i) => anguloEn(p, v[(i + 1) % 3], v[(i + 2) % 3])));
        const t = Math.abs(m - 90) < 0.01 ? "rectángulo" : m > 90 ? "obtusángulo" : "acutángulo";
        assert.equal(a.solucion, t, `${m}°`);
        const rectos = elementos(a, "angulo").filter((x) => x.recto).map((x) => x.texto);
        assert.deepEqual(rectos, t === "rectángulo" ? ["90°"] : [], "el recto, con su cuadradito");
      }
    }
  });

  test("geometría/áreas de polígonos: la solución es el área del polígono DIBUJADO", () => {
    for (const gen of [are.areaTriangulo, are.areaCuadrilateros, com.figuraCompuesta]) {
      for (const a of todos(gen, 4)) {
        const [v] = elementos(a, "poligono");
        assert.ok(Math.abs(zapatero(v) - n(a.solucion)) < 1e-9, `${a.texto}: dibujo ${zapatero(v)}, solución ${a.solucion}`);
        assert.ok(cotasCiertas(a), `${a.texto}: una cota no mide lo que dice`);
      }
    }
    for (const a of todos(are.perimetroYArea, 4)) {
      const [v] = elementos(a, "poligono");
      const P = v.reduce((s, p, i) => s + dist(p, v[(i + 1) % v.length]), 0);
      assert.deepEqual(a.solucion, [P, zapatero(v)]);
      assert.ok(cotasCiertas(a));
    }
  });

  test("geometría/la altura dibujada es perpendicular a la base y mide lo que dice su etiqueta", () => {
    for (const a of [...todos(are.areaTriangulo, 4), ...todos(are.areaCuadrilateros, 4).filter((x) => x.forma !== "rombo")]) {
      const [alt] = elementos(a, "segmento");
      assert.equal(alt[0][0], alt[1][0], "vertical");
      const et = elementos(a, "etiqueta")[0];
      assert.equal(dist(...alt), n(et.texto), a.texto);
      // Al lado de la línea, no encima: si no, la tacha.
      assert.equal(et.ancla, "start");
      assert.equal(et.en[0], alt[0][0]);
    }
  });

  test("geometría/círculo: con π = 3,14, desde el radio o el diámetro del dibujo", () => {
    for (const [gen, f] of [[cir.longitudCircunferencia, (r) => 2 * 3.14 * r], [cir.areaCirculo, (r) => 3.14 * r * r]]) {
      let conDiametro = 0;
      for (const a of todos(gen, 4)) {
        const [c] = elementos(a, "circulo");
        const [seg] = elementos(a, "segmento");
        const etiqueta = n(elementos(a, "etiqueta")[0].texto);
        assert.ok(Math.abs(dist(...seg) - etiqueta) < 1e-9, "la etiqueta mide el segmento dibujado");
        if (Math.abs(dist(...seg) - 2 * c.radio) < 1e-9) conDiametro += 1;
        assert.ok(Math.abs(n(a.solucion) - f(c.radio)) < 1e-6, `${a.texto} → ${a.solucion}`);
      }
      assert.ok(conDiametro > 20, "la mitad dan el diámetro");
    }
  });

  test("geometría/problemas: la respuesta, recalculada desde el enunciado", () => {
    for (const a of todos(com.problemasDeAreas, 4)) {
      const x = (a.texto.match(/\d+/g) || []).map(Number);
      const r = n(a.solucion);
      const ok = {
        baldosas: () => (x[0] * 100 / x[2]) * (x[1] * 100 / x[2]) === r,
        valla: () => 2 * (x[0] + x[1]) * x[2] === r,
        pintura: () => x[0] * x[1] / x[2] === r,
        cesped: () => x[0] * x[1] - x[2] * x[3] === r,
        mantel: () => 4 * x[0] === r,
      }[a.contexto]();
      assert.ok(ok, `${a.contexto}: ${a.texto} → ${a.solucion}`);
    }
  });

  test("geometría/respuestas-trampa: cada error da lo que escribiría el alumno", () => {
    const t = (clave, ap) => Object.fromEntries(trampasDelApartado(clave, ap).map((x) => [x.error, x.respuesta]));
    assert.deepEqual(t("perimetro_y_area", { solucion: [22, 28], cambiados: [28, 22] }), { 1: "28, 22" });
    assert.deepEqual(t("area_triangulo", { solucion: "20", sinMitad: "40", conElLado: "24" }), { 2: "40", 3: "24" });
    assert.deepEqual(t("area_circulo", { solucion: "28,26", diametroComoRadio: "113,04", r2ComoDoble: "18,84" }), { 4: "113,04", 5: "18,84" });
    assert.deepEqual(t("complementario_suplementario", { solucion: "55°", confundido: "145°" }), { 6: "145°" });
    assert.deepEqual(t("angulo_del_triangulo", { solucion: "70°", a: 50, b: 60 }), { 7: "250°" });
    assert.deepEqual(t("figura_compuesta", { solucion: "68", exterior: "80" }), { 8: "80" });
  });

  test("geometría/las trampas salen de lo dibujado: sin dividir, con el lado, con el diámetro", () => {
    for (const a of todos(are.areaTriangulo, 4)) {
      assert.equal(n(a.sinMitad), 2 * n(a.solucion));
      const lado = elementos(a, "cota").find((c) => c.de[1] !== c.a[1]);
      const base = elementos(a, "cota").find((c) => c.de[1] === c.a[1]);
      assert.equal(n(a.conElLado), n(base.texto) * n(lado.texto) / 2);
    }
    for (const a of todos(cir.areaCirculo, 4).filter((x) => x.diametroComoRadio)) {
      const d = n(elementos(a, "etiqueta")[0].texto);
      assert.ok(Math.abs(n(a.diametroComoRadio) - 3.14 * d * d) < 1e-6);
    }
  });

  test("geometría/todo apartado trae su razón y su figura dibujable", async () => {
    const { Window } = await import("happy-dom");
    const w = globalThis.window || new Window();
    const { buildFigura } = await import("../../assets/shared/hoja/js/figuras/index.js");
    for (const b of Object.values(GEOMETRIA_1ESO.baterias).flat()) {
      for (const a of todos(b.generador, b.maximo)) {
        assert.ok(a.razon && a.razon.length > 10, `${b.clave}: sin razón`);
        for (const campo of [a.latex, a.latexResuelto, a.texto, a.razon]) assert.ok(!/undefined|NaN|\[object|null|\d\.\d/.test(campo), `${b.clave}: ${campo}`);
        if (a.figura) assert.ok(buildFigura(a.figura, w.document), `${b.clave}: la figura no se puede dibujar`);
      }
    }
  });

  test("geometría/el montador arma una hoja de cada objetivo en las tres intensidades", () => {
    for (const objetivo of objetivosDe(GEOMETRIA_1ESO)) {
      for (const intensidad of Object.keys(INTENSIDADES)) {
        const { hoja, soluciones } = montaHoja({ tema: GEOMETRIA_1ESO, objetivo, intensidad, azar: crearAzar(`${objetivo}${intensidad}`) });
        assert.ok(hoja.actividades.length >= 2);
        soluciones.forEach((s, i) => assert.equal(s.respuestas.length, hoja.actividades[i].apartados.length));
        // Las figuras llegan a la hoja (el objetivo 2 empieza por
        // complementarios, que no llevan; los demás, siempre alguna).
        const conFigura = hoja.actividades.flatMap((x) => x.apartados).filter((x) => typeof x === "object" && x.figura);
        assert.ok(conFigura.length > 0, `objetivo ${objetivo} ${intensidad}: ninguna figura en la hoja`);
      }
    }
  });
}
