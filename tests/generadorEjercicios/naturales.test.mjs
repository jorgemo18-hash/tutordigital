// EL TEMA NÚMEROS NATURALES: cada respuesta recalculada por otro camino a
// partir de lo que se IMPRIME, con 40 semillas. Los recuentos se hacen
// aquí ENUMERANDO (se construyen todas las parejas, todos los menús), no
// con la multiplicación del generador.
export async function run({ test, assert }) {
  const num = await import("../../server/lib/generadorEjercicios/generadores/naturales/numeracion.js");
  const div = await import("../../server/lib/generadorEjercicios/generadores/naturales/division.js");
  const pro = await import("../../server/lib/generadorEjercicios/generadores/naturales/propiedades.js");
  const rec = await import("../../server/lib/generadorEjercicios/generadores/naturales/recuento.js");
  const prob = await import("../../server/lib/generadorEjercicios/generadores/naturales/problemas.js");
  const { crearAzar } = await import("../../server/lib/generadorEjercicios/aleatorio.js");
  const { trampasDelApartado } = await import("../../server/lib/generadorEjercicios/errores/trampasDelApartado.js");
  const { montaHoja, INTENSIDADES } = await import("../../server/lib/generadorEjercicios/montadorDeHoja.js");
  const { objetivosDe } = await import("../../server/lib/generadorEjercicios/catalogoDeBaterias.js");
  const { NATURALES_1ESO } = await import("../../server/lib/generadorEjercicios/temas/naturales1eso.js");

  const SEMILLAS = Array.from({ length: 40 }, (_, i) => `na${i}`);
  const todos = (gen, cuantos) => SEMILLAS.flatMap((s) => gen(crearAzar(s), { cuantos }).apartados);
  // "3 745 210" → 3745210; todos los números de un texto.
  const leer = (t) => Number(String(t).replace(/ /g, ""));
  const numeros = (t) => (t.match(/\d[\d ]*\d|\d/g) || []).map((n) => leer(n.trim()));
  // Bien agrupado: cinco cifras o más, de tres en tres.
  const agrupado = (t) => !/\d{5}/.test(t);

  test("naturales/valor de la cifra: la cifra por el valor de su posición", () => {
    for (const a of todos(num.valorDeLaCifra, 8)) {
      const [, n, cifra] = a.texto.match(/^En (.+), el (\d) vale/);
      const s = n.replace(/ /g, "");
      const pos = s.length - 1 - s.indexOf(cifra);
      assert.equal(leer(a.solucion), Number(cifra) * 10 ** pos, a.texto);
      assert.equal(new Set(s).size, s.length, "cifras distintas");
      assert.ok(agrupado(a.texto) && agrupado(a.solucion));
    }
  });

  test("naturales/redondear: el múltiplo más cercano; y la mitad hacia arriba", () => {
    const V = { decenas: 10, centenas: 100, millares: 1000 };
    let arriba = 0;
    for (const a of todos(num.redondeaNatural, 8)) {
      const [n, resto] = a.texto.split(" a las ");
      const v = V[resto.replace(": ___", "")];
      const x = leer(n);
      const r = Math.floor((x + v / 2) / v) * v;
      assert.equal(leer(a.solucion), r, a.texto);
      if (r > x) arriba += 1;
    }
    assert.ok(arriba > 100, `solo ${arriba} hacia arriba`);
  });

  test("naturales/estimar: redondeando cada número antes de operar", () => {
    for (const a of todos(num.estimaOperacion, 6)) {
      const [x, y] = numeros(a.texto);
      const op = a.texto.includes("·") ? "·" : a.texto.includes("+") ? "+" : "−";
      const rd = (n, v) => Math.round(n / v) * v;
      const esperado = op === "·" ? rd(x, 10) * y : op === "+" ? rd(x, 100) + rd(y, 100) : rd(x, 100) - rd(y, 100);
      assert.equal(leer(a.solucion), esperado, a.texto);
    }
  });

  test("naturales/división: cociente y resto cumplen D = d · c + r con r < d", () => {
    for (const a of todos(div.divisionYPrueba, 6)) {
      const [D, d] = numeros(a.texto);
      const [c, r] = a.solucion;
      assert.equal(d * c + r, D, a.texto);
      assert.ok(r > 0 && r < d, a.texto);
    }
    for (const a of todos(div.terminoDeLaDivision, 6)) {
      const n = numeros(a.texto);
      if (/Dividendo:/.test(a.texto)) { const [d, c, r] = n; assert.equal(leer(a.solucion), d * c + r, a.texto); }
      else if (/Divisor:/.test(a.texto)) { const [D, c, r] = n; assert.equal(a.solucion * c + r, D, a.texto); assert.ok(r < a.solucion); }
      else { const [d, r] = n; assert.equal(a.solucion, r < d ? "sí" : "no", a.texto); }
    }
    const posibles = todos(div.terminoDeLaDivision, 6).filter((a) => /posible/.test(a.texto)).map((a) => a.solucion);
    assert.ok(posibles.includes("sí") && posibles.includes("no"), "el '¿es posible?' no es siempre no");
  });

  test("naturales/propiedades y cálculo mental: la cuenta del folio", () => {
    const evalua = (t) => new Function(`return ${t.replace(/·/g, "*").replace(/−/g, "-").replace(/:/g, "/")};`)();
    for (const gen of [pro.distributiva, pro.factorComun, pro.calculoMental]) {
      for (const a of todos(gen, 8)) {
        assert.equal(leer(a.solucion), evalua(a.texto.replace(" = ___", "")), a.texto);
        assert.ok(agrupado(a.texto) && agrupado(String(a.solucion)));
      }
    }
    for (const a of todos(pro.factorComun, 6)) {
      const [x, b, , c] = numeros(a.texto);
      assert.equal((a.texto.includes("+") ? b + c : b - c) % 10, 0, `${a.texto}: sacar factor común no deja un número redondo`);
      void x;
    }
    // Trucos distintos dentro de una hoja (se repiten solo si hay más
    // apartados que trucos).
    for (const s of SEMILLAS) {
      const trucos = pro.calculoMental(crearAzar(s), { cuantos: 6 }).apartados.map((a) => a.truco);
      assert.equal(new Set(trucos).size, 6, `${s}: ${trucos}`);
    }
  });

  test("naturales/recuento: la respuesta, enumerando todas las posibilidades", () => {
    const producto = (listas) => listas.reduce((acc, n) => acc.flatMap((x) => Array.from({ length: n }, (_, k) => [...x, k])), [[]]).length;
    for (const a of todos(rec.recuentoMultiplicativo, 4)) {
      assert.equal(a.solucion, producto(numeros(a.texto)), a.texto);
    }
    const sinOrden = (n) => { let k = 0; for (let i = 0; i < n; i += 1) for (let j = i + 1; j < n; j += 1) k += 1; return k; };
    const conOrden = (n) => { let k = 0; for (let i = 0; i < n; i += 1) for (let j = 0; j < n; j += 1) if (i !== j) k += 1; return k; };
    for (const a of todos(rec.recuentoSinOrden, 4)) {
      const n = a.contexto === "cifras" ? numeros(a.texto).length : numeros(a.texto)[0];
      assert.equal(a.solucion, a.contexto === "cifras" ? conOrden(n) : sinOrden(n), a.texto);
    }
  });

  test("naturales/problemas: la respuesta, desde el enunciado; y el resto bien interpretado", () => {
    for (const a of todos(prob.problemasNaturales, 4)) {
      const n = numeros(a.texto);
      const r = leer(a.solucion.split(" ")[0] + (a.solucion.split(" ")[1]?.match(/^\d/) ? a.solucion.split(" ")[1] : ""));
      const ok = {
        excursion: () => n[0] * n[1] + n[2] === r,
        ahorro: () => n[0] * n[1] - n[2] === r,
        cajas: () => n[0] * n[1] - n[2] === r,
        libro: () => n[0] * n[1] + n[2] === r,
        reparto: () => (n[0] - n[2]) === r * n[1],
      }[a.contexto]();
      assert.ok(ok, `${a.contexto}: ${a.texto} → ${a.solucion}`);
    }
    for (const a of todos(prob.problemasDeResto, 4)) {
      const n = numeros(a.texto);
      const [total, porCada] = { autobuses: [n[0], n[1]], cajas_huevos: [n[0], n[1]], sobran: [n[0], n[1]], estantes: [n[1], n[0]], tablas: [n[0], n[1]] }[a.contexto];
      const c = Math.floor(total / porCada);
      const r = total % porCada;
      assert.ok(r > 0, `${a.texto}: sin resto no hay nada que interpretar`);
      const esperado = { autobuses: c + 1, estantes: c + 1, cajas_huevos: c, tablas: c, sobran: r }[a.contexto];
      assert.equal(a.solucion, esperado, a.texto);
    }
  });

  test("naturales/respuestas-trampa: cada error da lo que escribiría el alumno", () => {
    const t = (clave, apartado) => Object.fromEntries(trampasDelApartado(clave, apartado).map((x) => [x.error, x.respuesta]));
    assert.deepEqual(t("redondea_natural", { solucion: "5000", cortado: "4000" }), { 1: "4000" });
    assert.deepEqual(t("valor_de_la_cifra", { solucion: "40 000", cifra: "4" }), { 2: "4" });
    assert.deepEqual(t("termino_de_la_division", { solucion: "187", sinResto: "180" }), { 3: "180" });
    assert.deepEqual(t("distributiva_naturales", { solucion: 91, soloPrimero: 73 }), { 4: "73" });
    assert.deepEqual(t("recuento_multiplicativo", { solucion: 12, sumando: 7 }), { 5: "7" });
    assert.deepEqual(t("recuento_sin_orden", { solucion: 10, contandoDosVeces: 20 }), { 6: "20" });
    assert.deepEqual(t("recuento_sin_orden", { solucion: 12, contandoDosVeces: null }), {}, "con orden no hay trampa");
    assert.deepEqual(t("problemas_de_resto", { solucion: 5, otraLectura: 4 }), { 7: "4" });
    assert.deepEqual(t("calculo_mental_trucos", { solucion: "230", aMedias: "460" }), { 8: "460" });
  });

  test("naturales/las trampas salen de lo impreso", () => {
    for (const a of todos(pro.distributiva, 7)) {
      const [x, b, c] = numeros(a.texto);
      assert.equal(a.soloPrimero, a.texto.includes("+") ? x * b + c : x * b - c, a.texto);
    }
    for (const a of todos(rec.recuentoMultiplicativo, 4)) {
      assert.equal(a.sumando, numeros(a.texto).reduce((s, n) => s + n, 0), a.texto);
    }
    for (const a of todos(div.terminoDeLaDivision, 6).filter((x) => x.sinResto)) {
      const [d, c] = numeros(a.texto);
      assert.equal(leer(a.sinResto), d * c, a.texto);
    }
  });

  test("naturales/todo apartado trae su razón, sin 'undefined', 'NaN' ni números sin agrupar", () => {
    for (const b of Object.values(NATURALES_1ESO.baterias).flat()) {
      for (const a of todos(b.generador, b.maximo)) {
        assert.ok(a.razon && a.razon.length > 10, `${b.clave}: sin razón`);
        for (const campo of [a.latex, a.latexResuelto, a.texto, a.razon]) {
          assert.ok(!/undefined|NaN|\[object|null/.test(campo), `${b.clave}: ${campo}`);
          assert.ok(agrupado(campo.replace(/\$[^$]*\$/g, "")), `${b.clave}: número sin agrupar en ${campo}`);
        }
      }
    }
  });

  test("naturales/el montador arma una hoja de cada objetivo en las tres intensidades", () => {
    for (const objetivo of objetivosDe(NATURALES_1ESO)) {
      for (const intensidad of Object.keys(INTENSIDADES)) {
        const { hoja, soluciones } = montaHoja({ tema: NATURALES_1ESO, objetivo, intensidad, azar: crearAzar(`${objetivo}${intensidad}`) });
        assert.ok(hoja.actividades.length >= 2);
        soluciones.forEach((s, i) => assert.equal(s.respuestas.length, hoja.actividades[i].apartados.length));
      }
    }
  });
}
