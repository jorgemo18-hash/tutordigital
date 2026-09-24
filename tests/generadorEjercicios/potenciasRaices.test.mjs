// EL TEMA POTENCIAS Y RAÍCES: cada respuesta, recalculada por otro camino a
// partir de lo que se IMPRIME, con muchas semillas (mismo método que
// divisibilidad.test.mjs).
export async function run({ test, assert }) {
  const pot = await import("../../server/lib/generadorEjercicios/generadores/potenciasRaices/potencias.js");
  const not = await import("../../server/lib/generadorEjercicios/generadores/potenciasRaices/notacion.js");
  const pro = await import("../../server/lib/generadorEjercicios/generadores/potenciasRaices/propiedades.js");
  const rai = await import("../../server/lib/generadorEjercicios/generadores/potenciasRaices/raices.js");
  const fmt = await import("../../server/lib/generadorEjercicios/generadores/potenciasRaices/formato.js");
  const { crearAzar } = await import("../../server/lib/generadorEjercicios/aleatorio.js");
  const { trampasDelApartado } = await import("../../server/lib/generadorEjercicios/errores/trampasDelApartado.js");
  const { montaHoja, INTENSIDADES } = await import("../../server/lib/generadorEjercicios/montadorDeHoja.js");
  const { objetivosDe } = await import("../../server/lib/generadorEjercicios/catalogoDeBaterias.js");
  const { POTENCIAS_RAICES_1ESO } = await import("../../server/lib/generadorEjercicios/temas/potenciasRaices1eso.js");

  const SEMILLAS = Array.from({ length: 40 }, (_, i) => `p${i}`);
  const todos = (gen, cuantos) => SEMILLAS.flatMap((s) => gen(crearAzar(s), { cuantos }).apartados);
  const SUPER = { "⁰": 0, "¹": 1, "²": 2, "³": 3, "⁴": 4, "⁵": 5, "⁶": 6, "⁷": 7, "⁸": 8, "⁹": 9 };
  const exp = (s) => Number([...s].map((c) => SUPER[c]).join(""));
  // "3⁴" → [3, 4]
  const leePotencia = (t) => { const m = t.match(/^(\d+)([⁰¹²³⁴⁵⁶⁷⁸⁹]+)$/); return [Number(m[1]), exp(m[2])]; };
  const sinEspacios = (t) => t.replace(/\s/g, "");

  test("formato: miles con espacio desde cinco cifras, coma decimal entre llaves en LaTeX", () => {
    assert.equal(fmt.milesTexto(3400), "3400");
    assert.equal(fmt.milesTexto(34507), "34 507");
    assert.equal(fmt.milesTexto(3400000), "3 400 000");
    assert.equal(fmt.milesLatex(3400000), "3\\,400\\,000");
    assert.equal(fmt.mantisaLatex({ entera: 3, decimales: "07" }), "3{,}07");
    assert.equal(fmt.mantisaTexto({ entera: 9, decimales: "" }), "9");
  });

  test("escribe como potencia: la base es el factor y el exponente cuántos hay", () => {
    for (const a of todos(pot.escribeComoPotencia, 7)) {
      const factores = a.texto.replace(" = ___", "").split(" · ").map(Number);
      assert.ok(factores.every((f) => f === factores[0]));
      assert.deepEqual(leePotencia(a.solucion), [factores[0], factores.length], a.texto);
    }
  });

  test("calcula la potencia: el valor multiplicando, y siempre una de exponente 1 y una de base 10", () => {
    for (const s of SEMILLAS) {
      const { apartados } = pot.calculaPotencia(crearAzar(s), { cuantos: 6 });
      for (const a of apartados) {
        const [b, e] = leePotencia(a.texto.replace(" = ___", ""));
        let v = 1; for (let k = 0; k < e; k += 1) v *= b;
        assert.equal(a.solucion, v, a.texto);
        assert.ok(!(b === 2 && e === 2), "2² no detecta el error 1");
      }
      assert.ok(apartados.some((a) => a.exponente === 1), `${s}: sin exponente 1`);
      assert.ok(apartados.some((a) => a.base === 10), `${s}: sin base 10`);
    }
  });

  test("la base o el exponente que falta: el único que cumple la igualdad impresa", () => {
    for (const a of todos(pot.potenciaQueFalta, 6)) {
      const [izq, der] = a.texto.split(", □")[0].split(" = ");
      const valor = Number(der);
      const [b, e] = izq.split("^");
      const cumple = [];
      for (let x = 1; x <= 20; x += 1) {
        if ((b === "□" ? x ** Number(e) : Number(b) ** x) === valor) cumple.push(x);
      }
      assert.deepEqual(cumple, [a.solucion], a.texto);
    }
  });

  test("compara potencias: el signo de los valores, y la mitad de las parejas con base y exponente cambiados", () => {
    for (const s of SEMILLAS) {
      const { apartados } = pot.comparaPotencias(crearAzar(s), { cuantos: 6 });
      let cambiadas = 0;
      for (const a of apartados) {
        const [x, y] = a.texto.split(" ___ ").map(leePotencia);
        const p = x[0] ** x[1];
        const q = y[0] ** y[1];
        assert.equal(a.solucion, p === q ? "=" : p < q ? "<" : ">", a.texto);
        if (x[0] === y[1] && x[1] === y[0]) cambiadas += 1;
      }
      assert.ok(cambiadas >= 3, `${s}: ${cambiadas} parejas cambiadas`);
    }
  });

  test("potencias de 10: en los dos sentidos, bien", () => {
    for (const a of todos(not.potenciasDeDiez, 7)) {
      if (a.texto.includes("10^□")) {
        assert.equal(10 ** a.solucion, Number(sinEspacios(a.texto.split(" = ")[0])), a.texto);
      } else {
        const e = exp(a.texto.replace(" = ___", "").replace("10", ""));
        assert.equal(Number(sinEspacios(a.solucion)), 10 ** e, a.texto);
      }
    }
  });

  test("descomposición polinómica: la suma vuelve al número, y siempre hay un 0 en medio", () => {
    for (const a of todos(not.descomposicionPolinomica, 4)) {
      const n = Number(sinEspacios(a.texto.replace(" = ___", "")));
      const suma = a.solucion.split(" + ").reduce((s, t) => {
        const m = t.match(/^(\d)(?: · 10([⁰¹²³⁴⁵⁶⁷⁸⁹]*))?$/);
        const e = m[2] === undefined ? 0 : m[2] === "" ? 1 : exp(m[2]);
        return s + Number(m[1]) * 10 ** e;
      }, 0);
      assert.equal(suma, n, a.texto);
      assert.ok(String(n).slice(1, -1).includes("0"), `${n}: sin 0 en medio`);
    }
  });

  test("notación científica: mantisa entre 1 y 10 y el mismo número en los dos sentidos", () => {
    const leeCientifica = (t) => {
      const m = t.match(/^(\d)(?:,(\d+))? · 10([⁰¹²³⁴⁵⁶⁷⁸⁹]+)$/);
      assert.ok(m, `mal escrita: ${t}`);
      return Math.round(Number(`${m[1]}.${m[2] || 0}`) * 10 ** exp(m[3]));
    };
    for (const a of todos(not.notacionCientifica, 6)) {
      const izq = a.texto.replace(" = ___", "");
      if (a.sentido === "a_cientifica") assert.equal(leeCientifica(a.solucion), Number(sinEspacios(izq)), a.texto);
      else assert.equal(Number(sinEspacios(a.solucion)), leeCientifica(izq), a.texto);
    }
  });

  test("producto, cociente y potencia de potencia: la potencia buena", () => {
    for (const [gen, op, re] of [
      [pro.productoMismaBase, (m, n) => m + n, / · /],
      [pro.cocienteMismaBase, (m, n) => m - n, / : /],
    ]) {
      for (const a of todos(gen, 7)) {
        const [x, y] = a.texto.replace(" = ___", "").split(re).map(leePotencia);
        assert.equal(x[0], y[0]);
        assert.deepEqual(leePotencia(a.solucion), [x[0], op(x[1], y[1])], a.texto);
        assert.ok(op(x[1], y[1]) >= 2, `${a.texto}: exponente final menor que 2`);
      }
    }
    for (const a of todos(pro.potenciaDePotencia, 6)) {
      const m = a.texto.match(/^\((\d+[⁰¹²³⁴⁵⁶⁷⁸⁹]+)\)([⁰¹²³⁴⁵⁶⁷⁸⁹]+)/);
      const [b, e] = leePotencia(m[1]);
      assert.deepEqual(leePotencia(a.solucion), [b, e * exp(m[2])], a.texto);
      assert.ok(!a.texto.includes("^") && !a.razon.includes("^"), "el ^ no se imprime");
    }
  });

  test("las propiedades juntas: el valor de la expresión es el de la potencia final", () => {
    for (const a of todos(pro.propiedadesMezcladas, 4)) {
      // Se evalúa con exponentes, sin calcular los números (que son enormes).
      const expr = a.texto.replace(" = ___", "");
      const b = Number(expr.match(/\d+/)[0]);
      let e = 0;
      let signo = 1;
      for (const trozo of expr.split(/ ([·:]) /)) {
        if (trozo === "·") { signo = 1; continue; }
        if (trozo === ":") { signo = -1; continue; }
        const pp = trozo.match(/^\((\d+)([⁰¹²³⁴⁵⁶⁷⁸⁹]+)\)([⁰¹²³⁴⁵⁶⁷⁸⁹]+)$/);
        const valor = pp ? exp(pp[2]) * exp(pp[3]) : trozo === String(b) ? 1 : leePotencia(trozo)[1];
        e += signo * valor;
      }
      assert.deepEqual(leePotencia(a.solucion), [b, e], a.texto);
      assert.ok(!a.razon.includes("^"), `REGRESIÓN (visto impreso): "^" en la explicación: ${a.razon}`);
    }
  });

  test("raíces: la exacta, la entera con su resto y entre qué dos está", () => {
    for (const a of todos(rai.raizExacta, 8)) {
      const n = Number(sinEspacios(a.texto.replace("√", "").replace(" = ___", "")));
      assert.equal(a.solucion * a.solucion, n);
      assert.notEqual(n, 4, "√4: la mitad y la raíz coinciden");
    }
    for (const s of SEMILLAS) {
      const redondas = rai.raizExacta(crearAzar(s), { cuantos: 8 }).apartados.filter((a) => a.solucion >= 20).length;
      assert.equal(redondas, 1, `REGRESIÓN (visto impreso): ${redondas} raíces de decenas redondas`);
    }
    for (const a of todos(rai.raizEntera, 6)) {
      const n = Number(a.texto.match(/√(\d+)/)[1]);
      const r = Math.floor(Math.sqrt(n));
      assert.notEqual(r * r, n);
      assert.equal(a.solucion, `${r}, resto ${n - r * r}`);
    }
    for (const a of todos(rai.raizEntreDos, 6)) {
      const n = Number(a.texto.match(/√(\d+)/)[1]);
      const r = Math.floor(Math.sqrt(n));
      assert.equal(a.solucion, `${r} y ${r + 1}`);
    }
  });

  test("respuestas-trampa: cada error da lo que haría el alumno", () => {
    const t = (clave, apartado) => Object.fromEntries(trampasDelApartado(clave, apartado).map((x) => [x.error, x.respuesta]));
    assert.deepEqual(t("calcula_potencia", { solucion: 32, base: 2, exponente: 5 }), { 1: "10" });
    assert.deepEqual(t("compara_potencias", { solucion: ">", pareja: [[2, 5], [5, 2]] }), { 1: "=" });
    assert.deepEqual(t("compara_potencias", { solucion: "=", pareja: [[2, 4], [4, 2]] }), {});
    assert.deepEqual(t("producto_misma_base", { solucion: "3⁶", base: 3, m: 4, n: 2 }), { 2: "3⁸", 3: "9⁶" });
    assert.deepEqual(t("cociente_misma_base", { solucion: "5⁶", base: 5, m: 8, n: 2 }), { 4: "5⁴" });
    assert.deepEqual(t("cociente_misma_base", { solucion: "5⁴", base: 5, m: 7, n: 3 }), {});
    assert.deepEqual(t("potencia_de_potencia", { solucion: "2¹²", base: 2, m: 3, n: 4 }), { 5: "2⁷" });
    assert.deepEqual(t("notacion_cientifica", { solucion: "4,5 · 10⁶", sentido: "a_cientifica", mantisa: { entera: 4, decimales: "5", e: 6 } }), { 6: "4,5 · 10⁷" });
    assert.deepEqual(t("raiz_exacta", { solucion: 4, numero: 16 }), { 7: "8" });
    assert.deepEqual(t("raiz_entera", { solucion: "7, resto 1", numero: 50, raiz: 7 }), { 8: "7, resto 43" });
  });

  test("todo apartado trae su razón, y en el texto no hay 'undefined' ni 'NaN'", () => {
    for (const b of Object.values(POTENCIAS_RAICES_1ESO.baterias).flat()) {
      for (const a of todos(b.generador, b.maximo)) {
        assert.ok(a.razon && a.razon.length > 10, `${b.clave}: sin razón`);
        for (const campo of [a.latex, a.latexResuelto, a.texto, a.razon]) {
          assert.ok(!/undefined|NaN|\[object/.test(campo), `${b.clave}: ${campo}`);
        }
      }
    }
  });

  test("el montador arma una hoja de cada objetivo en las tres intensidades", () => {
    for (const objetivo of objetivosDe(POTENCIAS_RAICES_1ESO)) {
      for (const intensidad of Object.keys(INTENSIDADES)) {
        const { hoja, soluciones } = montaHoja({ tema: POTENCIAS_RAICES_1ESO, objetivo, intensidad, azar: crearAzar(`${objetivo}${intensidad}`) });
        assert.ok(hoja.actividades.length >= 2);
        soluciones.forEach((s, i) => assert.equal(s.respuestas.length, hoja.actividades[i].apartados.length));
      }
    }
  });
}
