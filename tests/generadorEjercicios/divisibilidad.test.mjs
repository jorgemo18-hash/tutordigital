// EL TEMA DIVISIBILIDAD: que cada respuesta sea la buena, comprobada por un
// camino DISTINTO del que la calcula.
//
// Los generadores resuelven con aritmetica.js. Aquí cada solución se vuelve a
// sacar a fuerza bruta a partir de lo que se IMPRIME (los números del texto),
// no de los datos internos del apartado: si el enunciado y la solución se
// separaran —el hueco en otra cifra, el tramo de primos con otros extremos—,
// estos tests lo verían. Y con muchas semillas, porque un generador que
// falla una vez de cada cincuenta es un generador que falla en clase.
export async function run({ test, assert }) {
  const A = await import("../../server/lib/generadorEjercicios/generadores/divisibilidad/aritmetica.js");
  const md = await import("../../server/lib/generadorEjercicios/generadores/divisibilidad/multiplosDivisores.js");
  const cr = await import("../../server/lib/generadorEjercicios/generadores/divisibilidad/criterios.js");
  const pr = await import("../../server/lib/generadorEjercicios/generadores/divisibilidad/primos.js");
  const fa = await import("../../server/lib/generadorEjercicios/generadores/divisibilidad/factorizacion.js");
  const mm = await import("../../server/lib/generadorEjercicios/generadores/divisibilidad/mcdMcm.js");
  const pb = await import("../../server/lib/generadorEjercicios/generadores/divisibilidad/problemas.js");
  const { crearAzar } = await import("../../server/lib/generadorEjercicios/aleatorio.js");
  const { trampasDelApartado } = await import("../../server/lib/generadorEjercicios/errores/trampasDelApartado.js");
  const { montaHoja, INTENSIDADES } = await import("../../server/lib/generadorEjercicios/montadorDeHoja.js");
  const { objetivosDe } = await import("../../server/lib/generadorEjercicios/catalogoDeBaterias.js");
  const { DIVISIBILIDAD_1ESO } = await import("../../server/lib/generadorEjercicios/temas/divisibilidad1eso.js");

  const SEMILLAS = Array.from({ length: 40 }, (_, i) => `s${i}`);
  const numeros = (t) => (t.match(/\d+/g) || []).map(Number);
  const bruto = {
    divisores: (n) => Array.from({ length: n }, (_, i) => i + 1).filter((d) => n % d === 0),
    primo: (n) => n > 1 && bruto.divisores(n).length === 2,
    mcd: (a, b) => Math.max(...bruto.divisores(a).filter((d) => b % d === 0)),
    mcm: (a, b) => { for (let m = Math.max(a, b); ; m += 1) if (m % a === 0 && m % b === 0) return m; },
  };
  // Cada apartado de cada semilla, con el tamaño máximo de la batería.
  const todos = (gen, cuantos = 8) => SEMILLAS.flatMap((s) => gen(crearAzar(s), { cuantos }).apartados);

  // ── La aritmética ──────────────────────────────────────────────────────
  test("aritmética: divisores, primos, factores, m.c.d. y m.c.m. contra la fuerza bruta", () => {
    for (let n = 1; n <= 400; n += 1) {
      assert.deepEqual(A.divisores(n), bruto.divisores(n), `divisores de ${n}`);
      assert.equal(A.esPrimo(n), bruto.primo(n), `¿${n} es primo?`);
      assert.equal(A.desdeFactores(A.factoriza(n)), n, `factores de ${n}`);
      assert.ok(A.factoriza(n).every(([p]) => bruto.primo(p)), `${n}: un factor no es primo`);
    }
    for (const [a, b] of [[24, 36], [12, 18], [7, 13], [60, 84], [45, 125]]) {
      assert.equal(A.mcd(a, b), bruto.mcd(a, b));
      assert.equal(A.mcm(a, b), bruto.mcm(a, b));
      assert.equal(A.desdeFactores(A.factoresDelMcd([a, b])), A.mcd(a, b));
      assert.equal(A.desdeFactores(A.factoresDelMcm([a, b])), A.mcm(a, b));
    }
    assert.equal(A.factoresTexto(A.factoriza(360)), "2³ · 3² · 5");
    assert.equal(A.factoresLatex(A.factoriza(360)), "2^{3} \\cdot 3^{2} \\cdot 5");
    assert.throws(() => A.divisores(0), /natural/);
  });

  // ── Objetivo 1 ─────────────────────────────────────────────────────────
  test("múltiplos siguientes: son los tres siguientes de la serie impresa", () => {
    for (const a of todos(md.continuaMultiplos, 6)) {
      const [x, y, z] = numeros(a.texto);
      assert.equal(y - x, z - y);
      assert.equal(x % (y - x), 0, `${a.texto}: no es una serie de múltiplos`);
      assert.deepEqual(a.solucion, [z + (y - x), z + 2 * (y - x), z + 3 * (y - x)]);
    }
  });

  test("¿múltiplo o divisor?: la respuesta es la de la división, y hay síes y noes", () => {
    for (const s of SEMILLAS) {
      const { apartados } = md.esMultiploODivisor(crearAzar(s), { cuantos: 8 });
      for (const a of apartados) {
        const [p, q] = numeros(a.texto);
        const grande = Math.max(p, q);
        const chico = Math.min(p, q);
        assert.equal(a.solucion, grande % chico === 0 ? "sí" : "no", a.texto);
        assert.notEqual(chico, 10, "por 10 se contesta sin dividir");
      }
      const si = apartados.filter((a) => a.solucion === "sí").length;
      assert.ok(si >= 2 && apartados.length - si >= 2, `${s}: ${si} síes de ${apartados.length}`);
    }
  });

  test("múltiplos entre dos números: todos los del tramo, y los extremos no lo son", () => {
    for (const a of todos(md.multiplosEntre, 4)) {
      const [n, desde, hasta] = numeros(a.texto);
      assert.ok(desde % n !== 0 && hasta % n !== 0, a.texto);
      const esperados = [];
      for (let k = desde + 1; k < hasta; k += 1) if (k % n === 0) esperados.push(k);
      assert.deepEqual(a.solucion, esperados, a.texto);
    }
  });

  test("todos los divisores: la lista completa, de 6 a 12", () => {
    for (const a of todos(md.todosLosDivisores, 4)) {
      const [n] = numeros(a.texto);
      assert.deepEqual(a.solucion, bruto.divisores(n));
      assert.ok(a.solucion.length >= 6 && a.solucion.length <= 12);
    }
  });

  // ── Objetivo 2 ─────────────────────────────────────────────────────────
  test("¿por cuáles de 2, 3, 5 y 10?: la respuesta dividiendo, y siempre con los dos casos-trampa del 3", () => {
    for (const s of SEMILLAS) {
      const { apartados } = cr.divisiblePor(crearAzar(s), { cuantos: 7 });
      for (const a of apartados) {
        const [n] = numeros(a.texto);
        const lista = [2, 3, 5, 10].filter((k) => n % k === 0);
        assert.deepEqual(a.solucion, lista.length ? lista : "ninguno", a.texto);
      }
      const n = apartados.map((a) => numeros(a.texto)[0]);
      assert.ok(n.some((x) => x % 3 === 0 && ![0, 3, 6, 9].includes(x % 10)), `${s}: falta un divisible por 3 que no acabe en 0, 3, 6 o 9`);
      assert.ok(n.some((x) => x % 3 !== 0 && [3, 9].includes(x % 10)), `${s}: falta uno que acabe en 3 o 9 sin ser divisible por 3`);
    }
  });

  test("la cifra que falta: todas las que valen, contando desde el número impreso", () => {
    for (const a of todos(cr.cifraQueFalta, 4)) {
      const [numero, pedido] = a.texto.split(", divisible por ");
      const divisores = numeros(pedido);
      const valen = [];
      for (let c = 0; c <= 9; c += 1) {
        const n = Number(numero.replace("□", String(c)));
        if (divisores.every((d) => n % d === 0)) valen.push(c);
      }
      assert.ok(!numero.startsWith("□"), "el hueco no puede ser la primera cifra");
      assert.deepEqual(a.solucion, valen, a.texto);
      assert.ok(valen.length > 0);
    }
  });

  test("REGRESIÓN (visto impreso): las cifras van juntas alrededor del □, no separadas", () => {
    for (const a of todos(cr.cifraQueFalta, 4)) assert.ok(!a.latex.includes("\\,"), a.latex);
  });

  // ── Objetivo 3 ─────────────────────────────────────────────────────────
  test("primo o compuesto: bien clasificado, y siempre dos impares compuestos que no acaban en 5", () => {
    for (const s of SEMILLAS) {
      const { apartados } = pr.primoOCompuesto(crearAzar(s), { cuantos: 6 });
      for (const a of apartados) {
        const [n] = numeros(a.texto);
        assert.equal(a.solucion, bruto.primo(n) ? "primo" : "compuesto", a.texto);
        assert.notEqual(n, 1);
      }
      const trampas = apartados.map((a) => numeros(a.texto)[0]).filter((n) => n % 2 && n % 5 && !bruto.primo(n));
      assert.ok(trampas.length >= 2, `${s}: ${trampas.length} impares compuestos`);
    }
  });

  test("primos entre dos números: los del tramo, hasta el 120", () => {
    for (const a of todos(pr.primosEntreDos, 3)) {
      const [desde, hasta] = numeros(a.texto);
      assert.ok(hasta <= 120);
      const esperados = [];
      for (let k = desde + 1; k < hasta; k += 1) if (bruto.primo(k)) esperados.push(k);
      assert.deepEqual(a.solucion, esperados, a.texto);
    }
  });

  // ── Objetivo 4 ─────────────────────────────────────────────────────────
  const SUPER = { "⁰": 0, "¹": 1, "²": 2, "³": 3, "⁴": 4, "⁵": 5, "⁶": 6, "⁷": 7, "⁸": 8, "⁹": 9 };
  const leeFactores = (t) => t.split(" · ").map((f) => {
    const m = f.match(/^(\d+)([⁰¹²³⁴⁵⁶⁷⁸⁹]*)$/);
    return [Number(m[1]), m[2] ? Number([...m[2]].map((c) => SUPER[c]).join("")) : 1];
  });

  test("descomposición: solo primos, con potencias, y su producto es el número", () => {
    for (const a of todos(fa.descomponEnFactores, 6)) {
      const [n] = numeros(a.texto);
      const factores = leeFactores(a.solucion);
      assert.equal(factores.reduce((x, [p, e]) => x * p ** e, 1), n, a.texto);
      assert.ok(factores.every(([p]) => bruto.primo(p)));
      assert.ok(factores.some(([, e]) => e > 1), `${n}: sin ninguna potencia`);
    }
  });

  test("¿qué número es?: el producto de lo impreso", () => {
    for (const a of todos(fa.numeroDesdeFactores, 6)) {
      const factores = leeFactores(a.texto.replace(" = ___", ""));
      assert.equal(a.solucion, factores.reduce((x, [p, e]) => x * p ** e, 1), a.texto);
    }
  });

  test("¿divisor mirando los factores?: la respuesta dividiendo, y salen los dos tipos de 'no'", () => {
    let exponente = 0;
    let primo = 0;
    for (const a of todos(fa.esDivisorPorFactores, 4)) {
      const [chico, grande] = a.texto.replace("¿Es ", "").replace("? ___", "").split(" divisor de ").map(leeFactores);
      const valor = (f) => f.reduce((x, [p, e]) => x * p ** e, 1);
      assert.equal(a.solucion, valor(grande) % valor(chico) === 0 ? "sí" : "no", a.texto);
      if (a.razon.includes("no está")) primo += 1;
      if (a.razon.includes("no cabe")) exponente += 1;
    }
    assert.ok(primo > 5 && exponente > 5, `${primo} por primo, ${exponente} por exponente`);
  });

  // ── Objetivo 5 ─────────────────────────────────────────────────────────
  test("m.c.d. y m.c.m. de dos: la cuenta buena, con factor común y sin que uno divida al otro", () => {
    for (const [gen, f] of [[mm.mcdDeDos, bruto.mcd], [mm.mcmDeDos, bruto.mcm]]) {
      for (const a of todos(gen, 5)) {
        const [x, y] = numeros(a.texto.replace(/m\.c\.[dm]\./, ""));
        assert.equal(a.solucion, f(x, y), a.texto);
        assert.ok(bruto.mcd(x, y) > 1 && x % y !== 0 && y % x !== 0, a.texto);
      }
    }
  });

  test("REGRESIÓN (visto impreso): la explicación no dice '7 = 7'", () => {
    for (const gen of [mm.mcdDeDos, mm.mcmDeDos, mm.mcdYMcmDeTres]) {
      for (const a of todos(gen, 5)) assert.ok(!/(^|[^\d·] )(\d+) = \2\b/.test(a.razon), a.razon);
    }
  });

  test("m.c.d. y m.c.m. de tres: las dos cuentas buenas", () => {
    for (const a of todos(mm.mcdYMcmDeTres, 3)) {
      const [x, y, z] = numeros(a.texto);
      const d = bruto.mcd(bruto.mcd(x, y), z);
      const m = bruto.mcm(bruto.mcm(x, y), z);
      assert.equal(a.solucion, `m.c.d. = ${d}; m.c.m. = ${m}`);
    }
  });

  // ── Objetivo 6 ─────────────────────────────────────────────────────────
  const COINCIDIR = /coincid|juntos|juntas|igual de altas|menor número/;
  test("problemas: cada uno pide la cuenta que su enunciado necesita", () => {
    for (const gen of [pb.problemasDeMcm, pb.problemasDeMcd, pb.problemasMezclados]) {
      for (const a of todos(gen, 3)) {
        const [x, y] = numeros(a.texto.replace(/de 1\.º y|de 2\.º|1\.º|2\.º/g, ""));
        const esMcm = COINCIDIR.test(a.texto);
        assert.equal(a.solucion, esMcm ? bruto.mcm(x, y) : bruto.mcd(x, y), a.texto);
        assert.equal(a.otra, esMcm ? bruto.mcd(x, y) : bruto.mcm(x, y));
      }
    }
  });

  test("la batería mezclada tiene de las dos clases", () => {
    for (const s of SEMILLAS) {
      const { apartados } = pb.problemasMezclados(crearAzar(s), { cuantos: 2 });
      const clases = new Set(apartados.map((a) => COINCIDIR.test(a.texto)));
      assert.equal(clases.size, 2, s);
    }
  });

  test("REGRESIÓN (visto impreso): una hoja no repite contexto de problema entre sus baterías", () => {
    for (const s of SEMILLAS) {
      const contextos = [pb.problemasDeMcm, pb.problemasDeMcd, pb.problemasMezclados]
        .flatMap((g) => g(crearAzar(s), { cuantos: 4 }).apartados.map((a) => a.contexto));
      assert.equal(new Set(contextos).size, contextos.length, `${s}: ${contextos.join(", ")}`);
    }
  });

  // ── Lo común ───────────────────────────────────────────────────────────
  const BATERIAS = Object.values(DIVISIBILIDAD_1ESO.baterias).flat();

  test("todo apartado trae su razón, y en el texto no hay 'undefined' ni 'NaN'", () => {
    for (const b of BATERIAS) {
      for (const a of todos(b.generador, b.maximo)) {
        assert.ok(a.razon && a.razon.length > 10, `${b.clave}: sin razón`);
        for (const campo of [a.latex, a.latexResuelto, a.texto, a.razon]) {
          assert.ok(!/undefined|NaN|\[object/.test(campo), `${b.clave}: ${campo}`);
        }
      }
    }
  });

  test("respuestas-trampa: cada error da lo que haría el alumno", () => {
    const t = (clave, apartado) => Object.fromEntries(trampasDelApartado(clave, apartado).map((x) => [x.error, x.respuesta]));
    assert.deepEqual(t("todos_los_divisores", { solucion: [1, 2, 3, 4, 6, 12], numero: 12 }), { 2: "2, 3, 4, 6" });
    assert.deepEqual(t("mcm_de_dos", { solucion: 36, pareja: [12, 18] }), { 5: "6", 7: "216" });
    assert.deepEqual(t("mcd_de_dos", { solucion: 12, pareja: [24, 36] }), { 5: "72", 6: "72" });
    assert.deepEqual(t("primo_o_compuesto", { solucion: "compuesto", numero: 91 }), { 4: "primo" });
    assert.deepEqual(t("primo_o_compuesto", { solucion: "compuesto", numero: 92 }), {});
    assert.deepEqual(t("divisible_por", { solucion: [3], numero: 2127 }), { 3: "ninguno" });
    assert.deepEqual(t("numero_desde_factores", { solucion: 40, factores: [[2, 3], [5, 1]] }), { 8: "30" });
    assert.deepEqual(t("es_multiplo_o_divisor", { solucion: "sí" }), { 1: "no" });
    assert.deepEqual(t("es_multiplo_o_divisor", { solucion: "no" }), {});
    assert.deepEqual(t("cifra_que_falta", { solucion: [1, 4, 7], cifras: [4, 3, 0], posicion: 2, divisores: [3] }), { 3: "0, 3, 6, 9" });
    assert.deepEqual(t("problemas_mcm", { solucion: 36, otra: 6 }), { 5: "6" });
    // Las de enteros no se cuelan: un apartado de divisibilidad no tiene árbol.
    assert.deepEqual(t("mcd_y_mcm_de_tres", { solucion: "m.c.d. = 6; m.c.m. = 180" }), { 5: "m.c.d. = 180; m.c.m. = 6" });
  });

  test("el montador arma una hoja de cada objetivo en las tres intensidades, con sus soluciones", () => {
    for (const objetivo of objetivosDe(DIVISIBILIDAD_1ESO)) {
      for (const intensidad of Object.keys(INTENSIDADES)) {
        const { hoja, soluciones } = montaHoja({ tema: DIVISIBILIDAD_1ESO, objetivo, intensidad, azar: crearAzar(`${objetivo}${intensidad}`) });
        assert.ok(hoja.actividades.length >= 2, `${objetivo} ${intensidad}`);
        assert.equal(soluciones.length, hoja.actividades.length);
        soluciones.forEach((s, i) => assert.equal(s.respuestas.length, hoja.actividades[i].apartados.length));
      }
    }
  });
}
