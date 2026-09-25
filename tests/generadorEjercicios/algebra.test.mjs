// EL TEMA ÁLGEBRA: cada respuesta recalculada por otro camino a partir de
// lo que se IMPRIME, con 40 semillas. El otro camino es evaluar el texto del
// folio como una cuenta de JavaScript (x = número) y buscar la solución de
// las ecuaciones PROBANDO, sin importar terminos.js: si esa escritura o esa
// aritmética estuvieran mal, comprobarlas con ellas mismas no demostraría
// nada.
export async function run({ test, assert }) {
  const ex = await import("../../server/lib/generadorEjercicios/generadores/algebra/expresiones.js");
  const sec = await import("../../server/lib/generadorEjercicios/generadores/algebra/secuencias.js");
  const ec = await import("../../server/lib/generadorEjercicios/generadores/algebra/ecuaciones.js");
  const prob = await import("../../server/lib/generadorEjercicios/generadores/algebra/problemas.js");
  const { crearAzar } = await import("../../server/lib/generadorEjercicios/aleatorio.js");
  const { trampasDelApartado } = await import("../../server/lib/generadorEjercicios/errores/trampasDelApartado.js");
  const { montaHoja, INTENSIDADES } = await import("../../server/lib/generadorEjercicios/montadorDeHoja.js");
  const { objetivosDe } = await import("../../server/lib/generadorEjercicios/catalogoDeBaterias.js");
  const { ALGEBRA_1ESO } = await import("../../server/lib/generadorEjercicios/temas/algebra1eso.js");

  const SEMILLAS = Array.from({ length: 40 }, (_, i) => `al${i}`);
  const todos = (gen, cuantos) => SEMILLAS.flatMap((s) => gen(crearAzar(s), { cuantos }).apartados);

  // "3x − 2", "2(x + 3) + 4x", "x²", "x/4" → función de x (o de n).
  const aJs = (t) => t.replace(/−/g, "-").replace(/([xn])²/g, "($1*$1)").replace(/(\d)\s*([xn(])/g, "$1*$2");
  const funcion = (t, letra = "x") => new Function(letra, `return ${aJs(t)};`);
  // Una ecuación "izq = der": las x enteras de −120 a 120 que la cumplen.
  function soluciones(ecuacion) {
    const [izq, der] = ecuacion.split("=").map((l) => funcion(l));
    const r = [];
    for (let x = -120; x <= 120; x += 1) if (izq(x) === der(x)) r.push(x);
    return r;
  }
  const ecuacionDe = (a) => a.texto.split(" → ")[0];

  test("álgebra/valor numérico: la cuenta del folio da la solución", () => {
    for (const a of todos(ex.valorNumerico, 8)) {
      const [, exp, x] = a.texto.match(/^(.*) para x = (.*): ___$/);
      assert.equal(funcion(exp)(Number(x.replace("−", "-"))), a.solucion, a.texto);
    }
  });

  test("álgebra/reducir: la expresión impresa y la reducida valen lo mismo para toda x", () => {
    for (const gen of [ex.reduceSemejantes, ex.reduceConParentesis]) {
      for (const a of todos(gen, 7)) {
        const exp = funcion(a.texto.replace(" = ___", ""));
        const red = funcion(a.solucion);
        for (const x of [-3, 0, 1, 2, 7]) assert.equal(exp(x), red(x), `${a.texto} ≠ ${a.solucion}`);
        // La reducida es ax + b de verdad: no queda nada por juntar.
        assert.match(a.solucion, /^−?\d*x [+−] \d+$/, a.solucion);
      }
    }
  });

  test("álgebra/traducir: la frase del doble de la suma sale SIEMPRE, con su pareja", () => {
    for (const s of SEMILLAS) {
      const { apartados } = ex.traduceEnunciado(crearAzar(s), { cuantos: 6 });
      assert.ok(apartados.some((a) => /^El doble de la suma/.test(a.texto)), s);
      assert.ok(apartados.some((a) => /^El doble de un número, más/.test(a.texto)), s);
      // Sin frases repetidas con otro número.
      const formas = apartados.map((a) => a.texto.replace(/\d+/g, "#"));
      assert.equal(new Set(formas).size, formas.length);
    }
  });

  test("álgebra/secuencias: los términos, el término lejano y la regla salen de la misma secuencia", () => {
    const lista = (t) => t.split(/, …|, ___/)[0].split(", ").map((n) => Number(n.replace("−", "-")));
    for (const a of todos(sec.siguientesTerminos, 6)) {
      const t = lista(a.texto);
      const d = t[1] - t[0];
      assert.ok(t.every((v, i) => i === 0 || v - t[i - 1] === d), a.texto);
      assert.deepEqual(a.solucion, [t[3] + d, t[3] + 2 * d]);
    }
    for (const a of todos(sec.terminoLejano, 4)) {
      const t = lista(a.texto);
      const n = Number(a.texto.match(/El término (\d+)/)[1]);
      let v = t[0];
      for (let k = 1; k < n; k += 1) v += t[1] - t[0];
      assert.equal(a.solucion, v, a.texto);
    }
    for (const a of todos(sec.terminoGeneral, 4)) {
      const t = lista(a.texto);
      const regla = funcion(a.solucion, "n");
      t.forEach((v, i) => assert.equal(regla(i + 1), v, `${a.texto} → ${a.solucion}`));
    }
  });

  test("álgebra/ecuaciones: la solución es la ÚNICA x entera que cumple la ecuación impresa", () => {
    const gens = [ec.ecuacionSumaResta, ec.ecuacionProductoCociente, ec.ecuacionDosPasos, ec.ecuacionXDosLados, ec.ecuacionConParentesis];
    for (const gen of gens) {
      for (const a of todos(gen, 8)) {
        assert.deepEqual(soluciones(ecuacionDe(a)), [a.solucion], a.texto);
        // Pequeña, salvo en x/a = b, donde x es la tabla de multiplicar (a · b).
        const tope = a.texto.startsWith("x/") ? 108 : 36;
        assert.ok(Math.abs(a.solucion) <= tope, `${a.texto}: x = ${a.solucion}, demasiado grande sin calculadora`);
      }
    }
  });

  test("álgebra/¿es solución?: el sí y el no son los de sustituir, y salen los dos", () => {
    for (const s of SEMILLAS) {
      const { apartados } = ec.compruebaSolucion(crearAzar(s), { cuantos: 6 });
      for (const a of apartados) {
        const [, x, ecuacion] = a.texto.match(/^¿Es x = (.*) solución de (.*)\? ___$/);
        assert.equal(soluciones(ecuacion).includes(Number(x.replace("−", "-"))) ? "sí" : "no", a.solucion, a.texto);
      }
      const r = apartados.map((a) => a.solucion);
      assert.ok(r.includes("sí") && r.includes("no"), `${s}: ${r}`);
      const xs = apartados.map((a) => a.texto.match(/x = (\S+) sol/)[1]);
      assert.equal(new Set(xs).size, xs.length, `${s}: se repite el número propuesto (${xs})`);
    }
  });

  test("álgebra/problemas: la solución cumple lo que dice el enunciado", () => {
    const n = (t) => (t.match(/\d+/g) || []).map(Number);
    const COMPRUEBA = {
      suma: (e, s) => { const [a, total] = n(e); return s + a === total; },
      triple: (e, s) => { const k = { doble: 2, triple: 3, cuádruple: 4, quíntuple: 5 }[e.match(/El ([^ ]+)/)[1]]; const [a, total] = n(e); return k * s - a === total; },
      cuadernos: (e, s) => { const [c, boli, total] = n(e); return c * s + boli === total; },
      mitad: (e, s) => { const [a, total] = n(e); return s / 2 + a === total; },
      consecutivos: (e, s) => { const [x, y, z] = n(s); return y === x + 1 && z === x + 2 && x + y + z === n(e)[0]; },
      edades: (e, s) => { const [h, ana] = n(s); const [d, total] = n(e); return ana === h + d && h + ana === total; },
      rectangulo: (e, s) => { const [an, la] = n(s); return la === 2 * an && 2 * (an + la) === n(e)[0]; },
      cromos: (e, s) => { const k = { doble: 2, triple: 3, cuádruple: 4 }[e.match(/tiene el ([^ ]+)/)[1]]; const [m, p] = n(s); return p === k * m && m + p === n(e)[0]; },
      hucha: (e, s) => { const [ini, sem, total] = n(e); return ini + sem * s === total; },
    };
    for (const gen of [prob.problemasDeNumeros, prob.problemasDeRepartos]) {
      for (const a of todos(gen, 3)) {
        assert.ok(COMPRUEBA[a.contexto](a.texto, a.solucion), `${a.contexto}: ${a.texto} → ${a.solucion}`);
        assert.ok(!/[−-]\s?\d/.test(a.texto), `${a.contexto}: un dato negativo en ${a.texto}`);
      }
    }
    // Una hoja no repite contexto dentro de una batería ni entre las dos.
    for (const s of SEMILLAS) {
      const ids = [prob.problemasDeNumeros, prob.problemasDeRepartos].flatMap((g) => g(crearAzar(s), { cuantos: 3 }).apartados.map((a) => a.contexto));
      assert.equal(new Set(ids).size, ids.length);
    }
  });

  test("álgebra/repartos: la solución dice de quién es cada número", () => {
    for (const a of todos(prob.problemasDeRepartos, 3)) {
      assert.match(a.latexResuelto, /\? [A-Z0-9]/, "tras la pregunta, mayúscula");
      if (a.contexto === "hucha") continue;
      assert.ok(typeof a.solucion === "string" && (a.contexto === "consecutivos" || /^[^;]+, \d+[^;]*; [^;]+, \d+/.test(a.solucion)), `${a.contexto}: ${a.solucion}`);
    }
  });

  test("álgebra/respuestas-trampa: cada error da lo que escribiría el alumno", () => {
    const t = (clave, apartado) => Object.fromEntries(trampasDelApartado(clave, apartado).map((x) => [x.error, x.respuesta]));
    const T = (coef, x = false) => ({ coef, x });
    assert.deepEqual(t("traduce_enunciado", { solucion: "2(x + 3)", trampa: "2x + 3" }), { 1: "2x + 3" });
    assert.deepEqual(t("traduce_enunciado", { solucion: "x + 1", trampa: null }), {});
    assert.deepEqual(t("valor_numerico", { solucion: 12, a: 3, b: 0, x: 4 }), { 2: "34" });
    assert.deepEqual(t("valor_numerico", { solucion: 23, a: 3, b: -1, x: 8 }), { 2: "37" });
    assert.deepEqual(t("valor_numerico", { solucion: 2, a: 3, b: -1, x: -1 }), {}, "con x negativa no hay 'pegado'");
    assert.deepEqual(t("valor_numerico", { solucion: 28, cuadrado: true, x: 5, b: 3 }), { 9: "13" });
    assert.deepEqual(t("valor_numerico", { solucion: 4, cuadrado: true, x: 2, b: 0 }), {}, "2² = 2 · 2: no detecta nada");
    assert.deepEqual(t("reduce_semejantes", { solucion: "2x + 7", ts: [T(3, true), T(5), T(-1, true), T(2)] }), { 3: "9x" });
    assert.deepEqual(t("reduce_con_parentesis", { solucion: "6x + 5", a: 2, b: 3, c: 4, d: -1 }), { 4: "6x + 2" });
    assert.deepEqual(t("ecuacion_suma_resta", { solucion: 8, conError5: 20 }), { 5: "20" });
    assert.deepEqual(t("ecuacion_producto_cociente", { solucion: 4, conError6: 9 }), { 6: "9" });
    assert.deepEqual(t("ecuacion_dos_pasos", { solucion: 3, conError5: 7, conError7: -1 }), { 5: "7", 7: "-1" });
    assert.deepEqual(t("ecuacion_con_parentesis", { solucion: 4, conError8: 5.5 }), { 8: "5.5" });
  });

  test("álgebra/las trampas de las ecuaciones son las del error, calculadas desde lo impreso", () => {
    // 3x + 6 = 15: sin cambiar el signo, 3x = 21 → 7; dividiendo antes, 5 − 6 = −1.
    for (const a of todos(ec.ecuacionDosPasos, 7)) {
      const [, k, signo, b, c] = ecuacionDe(a).match(/^(\d+)x ([+−]) (\d+) = (−?\d+)$/);
      const B = (signo === "+" ? 1 : -1) * Number(b); const C = Number(c.replace("−", "-"));
      const e5 = (C + B) / Number(k); const e7 = C / Number(k) - B;
      assert.equal(a.conError5, Number.isInteger(e5) ? e5 : null, a.texto);
      assert.equal(a.conError7, Number.isInteger(C / Number(k)) ? e7 : null, a.texto);
    }
    // 2(x + 3) = 14: multiplicando solo la x, 2x + 3 = 14.
    for (const a of todos(ec.ecuacionConParentesis, 4)) {
      const mal = ecuacionDe(a).replace(/^(\d+)\(x ([+−]) (\d+)\)/, "$1x $2 $3");
      const s = soluciones(mal);
      if (a.conError8 !== null) assert.deepEqual(s, [a.conError8], `${a.texto} / ${mal}`);
    }
  });

  test("álgebra/se escribe como en el cuaderno: ni '1x', ni '+ −', ni '−−'", () => {
    for (const b of Object.values(ALGEBRA_1ESO.baterias).flat()) {
      for (const a of todos(b.generador, b.maximo)) {
        assert.ok(a.razon && a.razon.length > 10, `${b.clave}: sin razón`);
        for (const campo of [a.latex, a.latexResuelto, a.texto, a.razon]) {
          assert.ok(!/undefined|NaN|\[object|null/.test(campo), `${b.clave}: ${campo}`);
          assert.ok(!/(^|[^\d])1[xn]|\+ [−-]|[−-] [−-]\d|[−-]{2}/.test(campo), `${b.clave}: ${campo}`);
          assert.ok(!/\b0x\b|[+−] 0\b(?! [·:])/.test(campo.replace(/= 0\b/g, "")), `${b.clave}: ${campo}`);
        }
      }
    }
  });

  test("álgebra/el montador arma una hoja de cada objetivo en las tres intensidades", () => {
    for (const objetivo of objetivosDe(ALGEBRA_1ESO)) {
      for (const intensidad of Object.keys(INTENSIDADES)) {
        const { hoja, soluciones: sol } = montaHoja({ tema: ALGEBRA_1ESO, objetivo, intensidad, azar: crearAzar(`${objetivo}${intensidad}`) });
        assert.ok(hoja.actividades.length >= 2);
        sol.forEach((s, i) => assert.equal(s.respuestas.length, hoja.actividades[i].apartados.length));
      }
    }
  });
}
