// EL TEMA FRACCIONES: cada respuesta recalculada por otro camino a partir de
// lo que se IMPRIME, con 40 semillas. El otro camino son racionales hechos
// aquí a mano, sin importar fraccion.js: si esa aritmética estuviera mal,
// comprobarla con ella misma no demostraría nada.
export async function run({ test, assert }) {
  const F = await import("../../server/lib/generadorEjercicios/generadores/fracciones/fraccion.js");
  const cant = await import("../../server/lib/generadorEjercicios/generadores/fracciones/cantidad.js");
  const eq = await import("../../server/lib/generadorEjercicios/generadores/fracciones/equivalencia.js");
  const cmp = await import("../../server/lib/generadorEjercicios/generadores/fracciones/comparar.js");
  const sr = await import("../../server/lib/generadorEjercicios/generadores/fracciones/sumaResta.js");
  const pc = await import("../../server/lib/generadorEjercicios/generadores/fracciones/productoCociente.js");
  const comb = await import("../../server/lib/generadorEjercicios/generadores/fracciones/combinadas.js");
  const prob = await import("../../server/lib/generadorEjercicios/generadores/fracciones/problemas.js");
  const { crearAzar } = await import("../../server/lib/generadorEjercicios/aleatorio.js");
  const { trampasDelApartado } = await import("../../server/lib/generadorEjercicios/errores/trampasDelApartado.js");
  const { montaHoja, INTENSIDADES } = await import("../../server/lib/generadorEjercicios/montadorDeHoja.js");
  const { objetivosDe } = await import("../../server/lib/generadorEjercicios/catalogoDeBaterias.js");
  const { FRACCIONES_1ESO } = await import("../../server/lib/generadorEjercicios/temas/fracciones1eso.js");

  const SEMILLAS = Array.from({ length: 40 }, (_, i) => `f${i}`);
  const todos = (gen, cuantos) => SEMILLAS.flatMap((s) => gen(crearAzar(s), { cuantos }).apartados);

  // ── Racionales a mano, para comprobar ──────────────────────────────────
  const g = (a, b) => (b ? g(b, a % b) : Math.abs(a));
  const R = (n, d = 1) => { const k = g(n, d) * Math.sign(d); return [n / k, d / k]; };
  const lee = (t) => { const [n, d] = t.trim().split("/").map(Number); return R(n, d ?? 1); };
  const OPS = {
    "+": ([a, b], [c, d]) => R(a * d + c * b, b * d),
    "−": ([a, b], [c, d]) => R(a * d - c * b, b * d),
    "·": ([a, b], [c, d]) => R(a * c, b * d),
    ":": ([a, b], [c, d]) => R(a * d, b * c),
  };
  const escribe = ([n, d]) => (d === 1 ? String(n) : `${n}/${d}`);
  // "a/b op c/d" o "(a/b op c/d) op e/f"… evaluado con jerarquía.
  function evalua(expr) {
    const s = expr.replace(/\s/g, "");
    let i = 0;
    const numero = () => { const m = s.slice(i).match(/^\d+(\/\d+)?/); i += m[0].length; return lee(m[0]); };
    const factor = () => { if (s[i] === "(") { i += 1; const v = sumaDe(); i += 1; return v; } return numero(); };
    const termino = () => { let v = factor(); while (s[i] === "·" || s[i] === ":") { const o = s[i]; i += 1; v = OPS[o](v, factor()); } return v; };
    function sumaDe() { let v = termino(); while (s[i] === "+" || s[i] === "−") { const o = s[i]; i += 1; v = OPS[o](v, termino()); } return v; }
    return sumaDe();
  }

  test("fracciones/aritmética: simplifica, opera y escribe como la comprobación a mano", () => {
    for (let a = 1; a < 13; a += 1) {
      for (let b = 1; b < 13; b += 1) {
        const x = F.frac(a, b); const y = F.frac(b, a + 1);
        assert.equal(F.texto(F.suma(x, y)), escribe(OPS["+"](R(a, b), R(b, a + 1))));
        assert.equal(F.texto(F.cociente(x, y)), escribe(OPS[":"](R(a, b), R(b, a + 1))));
      }
    }
    assert.equal(F.latex(F.frac(3, 4)), "\\dfrac{3}{4}");
    assert.equal(F.texto(F.simplifica(F.frac(8, 4))), "2");
  });

  test("fracciones/de una cantidad: el resultado entero, y el total a partir de la parte", () => {
    for (const a of todos(cant.fraccionDeCantidad, 8)) {
      const [f, n] = a.texto.replace(" = ___", "").split(" de ");
      const [p, q] = lee(f);
      assert.equal(a.solucion, (Number(n) * p) / q, a.texto);
      assert.ok(Number.isInteger(a.solucion));
    }
    for (const a of todos(cant.cantidadDesdeFraccion, 5)) {
      const m = a.texto.match(/Los (\d+\/\d+) de un número son (\d+)/);
      const [p, q] = lee(m[1]);
      assert.equal((a.solucion * p) / q, Number(m[2]), a.texto);
    }
  });

  test("fracciones/equivalentes: el □ cumple la igualdad, y los 'no' son de sumar lo mismo", () => {
    for (const a of todos(eq.equivalenteQueFalta, 7)) {
      const [izq, der] = a.texto.split(", □")[0].split(" = ");
      const conHueco = der.replace("□", String(a.solucion));
      assert.deepEqual(lee(conHueco), lee(izq), a.texto);
    }
    for (const a of todos(eq.sonEquivalentes, 8)) {
      const [x, y] = a.texto.replace(": ___", "").split(" y ").map(lee);
      assert.equal(a.solucion, x[0] === y[0] && x[1] === y[1] ? "sí" : "no", a.texto);
    }
  });

  test("fracciones/simplificar: la irreducible, y el m.c.d. es compuesto (una división no basta)", () => {
    for (const a of todos(eq.simplificaFraccion, 6)) {
      const [n, d] = a.texto.replace(" = ___", "").split("/").map(Number);
      assert.equal(a.solucion, escribe(R(n, d)), a.texto);
      const m = g(n, d);
      assert.ok([...Array(m).keys()].slice(2).some((k) => m % k === 0), `${a.texto}: m.c.d. ${m} es primo`);
    }
  });

  test("fracciones/comparar y ordenar: el signo y el orden de verdad; siempre dos de mismo numerador", () => {
    for (const s of SEMILLAS) {
      const { apartados } = cmp.comparaFracciones(crearAzar(s), { cuantos: 6 });
      for (const a of apartados) {
        const [x, y] = a.texto.split(" ___ ").map(lee);
        const v = x[0] * y[1] - y[0] * x[1];
        assert.equal(a.solucion, v < 0 ? "<" : v > 0 ? ">" : "=", a.texto);
      }
      const mismoNum = apartados.filter((a) => { const [x, y] = a.texto.split(" ___ ").map(lee); return x[0] === y[0]; });
      assert.ok(mismoNum.length >= 2, `${s}: ${mismoNum.length} de mismo numerador`);
    }
    for (const a of todos(cmp.ordenaFracciones, 3)) {
      const lista = a.texto.replace(" → ___", "").split(", ");
      const ordenada = [...lista].sort((p, q) => { const [x, y] = [lee(p), lee(q)]; return x[0] * y[1] - y[0] * x[1]; });
      assert.deepEqual(a.solucion, ordenada, a.texto);
    }
  });

  test("fracciones/cuentas: sumas, restas, productos, cocientes y combinadas dan lo de la cuenta a mano", () => {
    const gens = [sr.sumaMismoDenominador, sr.sumaDistintoDenominador, sr.enteroYFraccion, pc.multiplicaFracciones,
      pc.divideFracciones, comb.combinadaFracciones, comb.combinadaConParentesis];
    for (const gen of gens) {
      for (const a of todos(gen, 6)) {
        const expr = a.texto.replace(" = ___", "");
        assert.equal(a.solucion, escribe(evalua(expr)), a.texto);
        assert.ok(evalua(expr)[0] > 0, `${a.texto}: resultado no positivo`);
        assert.ok(!/= 1\. Después|[·:] 1 =/.test(a.razon), `REGRESIÓN (visto al generar): paso intermedio entero en ${a.razon}`);
      }
    }
    for (const a of todos(pc.fraccionDeFraccion, 6)) {
      const [x, y] = a.texto.replace(" = ___", "").split(" de ").map(lee);
      assert.equal(a.solucion, escribe(OPS["·"](x, y)), a.texto);
    }
  });

  test("fracciones/combinadas sin paréntesis: el orden IMPORTA (sin jerarquía daría otra cosa)", () => {
    for (const a of todos(comb.combinadaFracciones, 4)) {
      assert.ok(a.sinJerarquia === null || a.sinJerarquia !== a.solucion, a.texto);
    }
  });

  test("REGRESIÓN (visto impreso): las baterías de problemas salen con su ejemplo resuelto", async () => {
    const { conEjemploResuelto } = await import("../../server/lib/generadorEjercicios/ejemploResuelto.js");
    for (const gen of [prob.problemasFraccionDeCantidad, prob.problemasLoQueQueda]) {
      for (const s of SEMILLAS) assert.ok(conEjemploResuelto(gen, crearAzar(s), { cuantos: 3 }).llevaEjemplo, `${gen.name} ${s}`);
    }
  });

  test("fracciones/problemas: la respuesta de cada plantilla, y ninguna repetida entre las dos baterías", () => {
    for (const a of todos(prob.problemasFraccionDeCantidad, 3)) {
      const n = Number(a.texto.match(/(\d+) (alumnos|litros|€|m²|árboles)/)[1]);
      const m = a.texto.match(/los (\d+\/\d+)/);
      const [p, q] = m ? lee(m[1]) : a.texto.includes("la mitad") ? [1, 2] : [1, Number(a.razon.match(/: \d+ : (\d+)/)[1])];
      assert.equal(a.solucion, (n * p) / q, a.texto);
      assert.ok(!/los 1\//.test(a.texto), `REGRESIÓN: "los 1/…" en ${a.texto}`);
    }
    for (const s of SEMILLAS) {
      const ids = [prob.problemasFraccionDeCantidad, prob.problemasLoQueQueda]
        .flatMap((gen) => gen(crearAzar(s), { cuantos: 4 }).apartados.map((a) => a.contexto));
      assert.equal(new Set(ids).size, ids.length, ids.join(","));
    }
  });

  test("fracciones/respuestas-trampa: cada error da lo que escribiría el alumno", () => {
    const t = (clave, apartado) => Object.fromEntries(trampasDelApartado(clave, apartado).map((x) => [x.error, x.respuesta]));
    const f = F.frac;
    assert.deepEqual(t("suma_distinto_denominador", { solucion: "5/6", a: f(1, 2), b: f(1, 3), op: "+", bruto: f(5, 6) }), { 1: "2/5", 2: "2/6" });
    assert.deepEqual(t("suma_mismo_denominador", { solucion: "1/4", a: f(1, 8), b: f(1, 8), op: "+", bruto: f(2, 8) }), { 1: "2/16", 3: "2/8" });
    assert.deepEqual(t("entero_y_fraccion", { solucion: "11/4", entero: 2, f: f(3, 4), op: "+" }), { 4: "5/4" });
    assert.deepEqual(t("multiplica_fracciones", { solucion: "8/15", a: f(2, 3), b: f(4, 5) }), { 5: "10/12" });
    assert.deepEqual(t("divide_fracciones", { solucion: "5/6", a: f(2, 3), b: f(4, 5) }), { 6: "8/15", 7: "12/10", 3: "10/12" });
    assert.deepEqual(t("compara_fracciones", { solucion: "<", pareja: [f(1, 5), f(1, 3)], tipoDePareja: "mismo_numerador" }), { 8: ">" });
    assert.deepEqual(t("fraccion_de_cantidad", { solucion: 40, fraccion: f(2, 3), cantidad: 60 }), { 9: "90" });
    assert.deepEqual(t("simplifica_fraccion", { solucion: "3/4", grande: f(36, 48) }), { 11: "18/24" });
    assert.deepEqual(t("son_equivalentes", { solucion: "no" }), { 10: "sí" });
    assert.deepEqual(t("problemas_lo_que_queda", { solucion: 90, otra: 60 }), { 13: "60" });
  });

  test("fracciones/todo apartado trae su razón, sin 'undefined' ni 'NaN'", () => {
    for (const b of Object.values(FRACCIONES_1ESO.baterias).flat()) {
      for (const a of todos(b.generador, b.maximo)) {
        assert.ok(a.razon && a.razon.length > 10, `${b.clave}: sin razón`);
        for (const campo of [a.latex, a.latexResuelto, a.texto, a.razon]) {
          assert.ok(!/undefined|NaN|\[object|· 1 =/.test(campo), `${b.clave}: ${campo}`);
        }
      }
    }
  });

  test("fracciones/el montador arma una hoja de cada objetivo en las tres intensidades", () => {
    for (const objetivo of objetivosDe(FRACCIONES_1ESO)) {
      for (const intensidad of Object.keys(INTENSIDADES)) {
        const { hoja, soluciones } = montaHoja({ tema: FRACCIONES_1ESO, objetivo, intensidad, azar: crearAzar(`${objetivo}${intensidad}`) });
        assert.ok(hoja.actividades.length >= 2);
        soluciones.forEach((s, i) => assert.equal(s.respuestas.length, hoja.actividades[i].apartados.length));
      }
    }
  });
}
