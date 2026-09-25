// EL TEMA PROPORCIONALIDAD Y PORCENTAJES: cada respuesta recalculada por
// otro camino a partir de lo que se IMPRIME, con 40 semillas. Los números se
// leen del texto del folio ("16,80 €" → 1680 céntimos) y las cuentas se
// hacen aquí en céntimos, sin importar numeros.js: si su forma de escribir
// o de redondear estuviera mal, comprobarla con ella misma no diría nada.
export async function run({ test, assert }) {
  const raz = await import("../../server/lib/generadorEjercicios/generadores/proporcionalidad/razones.js");
  const tab = await import("../../server/lib/generadorEjercicios/generadores/proporcionalidad/tablas.js");
  const prob = await import("../../server/lib/generadorEjercicios/generadores/proporcionalidad/problemas.js");
  const por = await import("../../server/lib/generadorEjercicios/generadores/proporcionalidad/porcentajes.js");
  const vari = await import("../../server/lib/generadorEjercicios/generadores/proporcionalidad/variaciones.js");
  const con = await import("../../server/lib/generadorEjercicios/generadores/proporcionalidad/consumo.js");
  const { crearAzar } = await import("../../server/lib/generadorEjercicios/aleatorio.js");
  const { trampasDelApartado } = await import("../../server/lib/generadorEjercicios/errores/trampasDelApartado.js");
  const { montaHoja, INTENSIDADES } = await import("../../server/lib/generadorEjercicios/montadorDeHoja.js");
  const { objetivosDe } = await import("../../server/lib/generadorEjercicios/catalogoDeBaterias.js");
  const { PROPORCIONALIDAD_1ESO } = await import("../../server/lib/generadorEjercicios/temas/proporcionalidad1eso.js");

  const SEMILLAS = Array.from({ length: 40 }, (_, i) => `pr${i}`);
  const todos = (gen, cuantos) => SEMILLAS.flatMap((s) => gen(crearAzar(s), { cuantos }).apartados);

  // "16,80" → 16.8; "1 089" → 1089. Todos los números de un texto.
  const numeros = (t) => (t.match(/\d[\d ]*(?:,\d+)?/g) || []).map((n) => Number(n.replace(/ /g, "").replace(",", ".")));
  // Un precio escrito → céntimos. Exige el formato de precio: sin céntimos
  // o con DOS cifras ("2,40", nunca "2,4").
  function centimos(t) {
    const m = t.match(/^(\d+)(?:,(\d{2}))? €$/);
    assert.ok(m, `precio mal escrito: "${t}"`);
    return Number(m[1]) * 100 + Number(m[2] || 0);
  }
  const g = (a, b) => (b ? g(b, a % b) : a);

  test("proporcionalidad/razones: la razón pedida, en su orden y simplificada", () => {
    // Lo que se nombra PRIMERO en cada situación (copiado aquí, no importado).
    const NOMBRADO_PRIMERO = ["chicas", "bolas rojas", "partidos ganados", "vasos de agua", "gatos", "libros de aventuras", "canicas verdes", "cromos repetidos", "mesas"];
    const ordenes = new Set();
    for (const a of todos(raz.razonSimplificada, 6)) {
      const [x, y] = numeros(a.texto);
      const pedido = a.texto.match(/Razón de (.+?) a /)[1];
      const alDerecho = NOMBRADO_PRIMERO.includes(pedido);
      ordenes.add(alDerecho);
      const [n, d] = alDerecho ? [x, y] : [y, x];
      assert.equal(a.solucion, `${n / g(n, d)}/${d / g(n, d)}`, a.texto);
    }
    assert.equal(ordenes.size, 2, "se piden en los dos órdenes");
  });

  test("proporcionalidad/¿proporción?: el sí y el no son los de los productos cruzados, y salen los dos", () => {
    for (const s of SEMILLAS) {
      const { apartados } = raz.esProporcion(crearAzar(s), { cuantos: 6 });
      for (const a of apartados) {
        const [p, q, r, t] = numeros(a.texto);
        assert.equal(p * t === q * r ? "sí" : "no", a.solucion, a.texto);
      }
      assert.ok(apartados.some((a) => a.solucion === "sí") && apartados.some((a) => a.solucion === "no"));
    }
  });

  test("proporcionalidad/término que falta: entero y el único que cumple la proporción", () => {
    for (const a of todos(raz.terminoDeProporcion, 7)) {
      const [p, q, r] = numeros(a.texto);
      const x = a.solucion;
      assert.ok(Number.isInteger(x) && x > 0);
      if (/\/x/.test(a.texto)) assert.equal(p * x, q * r, a.texto);
      else assert.equal(p * r, q * x, a.texto);
    }
  });

  test("proporcionalidad/tablas: el sí es proporcional de verdad; completar da la constante en todas las columnas", () => {
    const filas = (t) => t.split(" | ").map((f) => f.replace(/ ___$|; a = .*$/, "").split(": ")[1].split(", "));
    for (const a of todos(tab.sonProporcionales, 4)) {
      const [xs, ys] = filas(a.texto).map((f) => f.map(Number));
      const prop = xs.every((x, j) => ys[j] * xs[0] === ys[0] * x);
      assert.equal(prop ? "sí" : "no", a.solucion, a.texto);
    }
    for (const a of todos(tab.completaTabla, 4)) {
      const [xs, ys] = filas(a.texto);
      const [va, vb] = a.solucion;
      const X = xs.map((v) => (v === "b" ? vb : Number(v)));
      const Y = ys.map((v) => (v === "a" ? va : Number(v)));
      X.forEach((x, j) => assert.equal(Y[j] * X[0], Y[0] * x, `${a.texto} → ${a.solucion}`));
      assert.ok(xs.includes("b") && ys.includes("a"), "un hueco en cada fila");
    }
  });

  test("proporcionalidad/reducción a la unidad: la respuesta es proporcional a los datos", () => {
    for (const a of todos(prob.problemasReduccionUnidad, 4)) {
      const [n1Oq, q1, n2] = numeros(a.texto);
      // "N cuadernos cuestan P. ¿… N2?" o "echa L litros en M minutos… en M2".
      const esPrecio = /€/.test(a.texto);
      const sol = esPrecio ? centimos(a.solucion) : numeros(a.solucion)[0];
      if (esPrecio) {
        const precio = centimos(a.texto.match(/(\d+(?:,\d{2})?) €/)[0]);
        const cant = /^(\d+)/.test(a.texto) ? n1Oq : numeros(a.texto)[0];
        assert.equal(sol * cant, precio * n2, a.texto);
      } else {
        assert.equal(sol * q1, n1Oq * n2, a.texto);
      }
      assert.ok(n2 % (esPrecio ? n1Oq : q1) !== 0, `${a.texto}: la cantidad nueva es múltiplo`);
    }
  });

  test("proporcionalidad/escalas, velocidad, divisas y recetas: cada contexto cumple su relación", () => {
    for (const a of todos(prob.problemasDeProporcionalidad, 4)) {
      const n = numeros(a.texto);
      const r = numeros(a.solucion)[0];
      const comprueba = {
        escala: () => Math.abs(n[1] * n[2] - r * 100000) < 1e-6,
        velocidad: () => (/Cuántas horas/.test(a.texto) ? n[0] * r === n[1] : n[0] * n[1] === r),
        divisas: () => Math.round(n[1] * n[2] * 100) === Math.round(r * 100),
        receta: () => n[1] * n[2] === r * n[0],
        coche: () => n[0] * n[2] === r * n[1],
      }[a.contexto];
      assert.ok(comprueba(), `${a.contexto}: ${a.texto} → ${a.solucion}`);
    }
  });

  test("proporcionalidad/% como fracción y decimal: iguales a p/100, con uno > 100 y uno < 1 siempre", () => {
    for (const s of SEMILLAS) {
      const { apartados } = por.porcentajeFraccionDecimal(crearAzar(s), { cuantos: 5 });
      const ps = apartados.map((a) => numeros(a.texto)[0]);
      assert.ok(ps.some((p) => p > 100) && ps.some((p) => p < 1), `${s}: ${ps}`);
      for (const a of apartados) {
        const p = numeros(a.texto)[0];
        const [f, d] = a.solucion;
        const [fn, fd] = f.split("/").map(Number);
        assert.equal(g(fn, fd), 1, `${f} no es irreducible`);
        assert.ok(fd !== 1, `${p} %: "${f}" no se escribe como fracción`);
        assert.ok(Math.abs(fn / fd - p / 100) < 1e-12, `${p} % ≠ ${f}`);
        assert.ok(Math.abs(Number(d.replace(",", ".")) - p / 100) < 1e-12, `${p} % ≠ ${d}`);
      }
    }
  });

  test("proporcionalidad/porcentajes: la cuenta del folio, con cantidades redondas", () => {
    for (const a of todos(por.porcentajeDeCantidad, 8)) {
      const [p, q] = numeros(a.texto);
      assert.equal(a.solucion * 100, p * q, a.texto);
      assert.equal(q % 10, 0, `${a.texto}: cantidad poco redonda`);
      assert.ok(q >= 40, `${a.texto}: demasiado pequeña para que valga la pena`);
    }
    for (const a of todos(por.quePorcentajeEs, 6)) {
      // La parte siempre es menor que el total (ningún porcentaje llega a 100).
      const [parte, total] = numeros(a.texto).sort((m, k) => m - k);
      assert.equal(a.solucion * total, parte * 100, a.texto);
    }
    for (const a of todos(por.totalDesdePorcentaje, 4)) {
      const p = Number(a.texto.match(/(\d+) %/)[1]);
      const parte = numeros(a.texto.replace(/\d+ %/, "")).find((v) => v > 0);
      assert.equal(a.solucion * p, parte * 100, a.texto);
    }
  });

  test("proporcionalidad/totales creíbles: ni clases de 260 alumnos ni excursiones de 150", () => {
    for (const a of [...todos(por.quePorcentajeEs, 6), ...todos(por.totalDesdePorcentaje, 4)]) {
      const total = /¿Qué porcentaje/.test(a.texto) ? Math.max(...numeros(a.texto)) : a.solucion;
      if (/clase|excursión/.test(a.texto)) assert.ok(total <= 60, `${a.texto} (${total})`);
      if (/examen/.test(a.texto)) assert.ok(total <= 50, a.texto);
      if (/instituto/.test(a.texto)) assert.ok(total >= 300, a.texto);
      assert.ok(!/(^|\D)1 (llevan|son|personas|alumnos)/.test(a.texto), `concordancia: ${a.texto}`);
    }
  });

  test("proporcionalidad/precio de antes: un artículo distinto en cada apartado", () => {
    for (const s of SEMILLAS) {
      const arts = vari.precioAntes(crearAzar(s), { cuantos: 4 }).apartados
        .map((a) => a.texto.match(/rebaja, (.+?) me/)?.[1]).filter(Boolean);
      assert.equal(new Set(arts).size, arts.length, `${s}: ${arts}`);
    }
  });

  test("proporcionalidad/rebajas, subidas y precio de antes: exactos al céntimo", () => {
    for (const a of todos(vari.rebajaPrecioFinal, 5)) {
      const precio = centimos(a.texto.match(/de (\d+) €/)[1] + " €");
      const p = numeros(a.texto.split("un ")[1])[0];
      assert.equal(centimos(a.solucion) * 100, precio * (100 - p), a.texto);
      assert.ok(/(tiene|tienen) un/.test(a.texto));
      if (/^(Unas|Unos)/.test(a.texto)) assert.match(a.texto, /tienen/);
    }
    for (const a of todos(vari.subidaEImpuestos, 4)) {
      const precio = centimos(a.texto.match(/(\d+(?:,\d{2})?) €/)[0]);
      const p = numeros(a.texto.slice(a.texto.indexOf("€")))[0];
      assert.equal(centimos(a.solucion) * 100, precio * (100 + p), a.texto);
    }
    for (const a of todos(vari.precioAntes, 4)) {
      const ahora = centimos(a.texto.match(/(\d+(?:,\d{2})?) €/)[0]);
      const p = numeros(a.texto)[0];
      const factor = /IVA/.test(a.texto) ? 100 + p : 100 - p;
      assert.equal(centimos(a.solucion) * factor, ahora * 100, a.texto);
      assert.equal(centimos(a.solucion) % 100, 0, "antes, euros enteros");
    }
  });

  test("proporcionalidad/mejor oferta: gana el de menor precio por unidad, que es el más caro en total", () => {
    for (const a of todos(con.mejorOferta, 4)) {
      const m = a.texto.match(/A: (\d+) \D+ por ([\d,]+ €)\. B: (\d+) \D+ por ([\d,]+ €)/);
      const [nA, pA, nB, pB] = [Number(m[1]), centimos(m[2]), Number(m[3]), centimos(m[4])];
      const mejor = pA * nB < pB * nA ? "A" : "B";
      assert.equal(a.solucion, mejor, a.texto);
      const masBaratoTotal = pA < pB ? "A" : "B";
      assert.notEqual(masBaratoTotal, mejor, `${a.texto}: el error 11 no se distinguiría`);
    }
  });

  test("proporcionalidad/promociones: lo que se paga, calculado desde la oferta", () => {
    for (const a of todos(con.promociones, 4)) {
      const u = centimos(a.texto.match(/(\d+(?:,\d{2})?) €/)[0]);
      const n = numeros(a.texto);
      const paga = {
        "3x2": () => (n[n.length - 1] / 3) * 2 * u,
        segunda_mitad: () => u * 1.5,
        segunda_70: () => u + (u * 30) / 100,
        "4x3": () => 6 * u,
        descuento_total: () => { const [k, , p] = n; return (k * u * (100 - p)) / 100; },
      }[a.contexto]();
      assert.equal(centimos(a.solucion), paga, `${a.contexto}: ${a.texto} → ${a.solucion}`);
    }
  });

  test("proporcionalidad/una hoja no repite situación dentro de una batería", () => {
    for (const s of SEMILLAS) {
      for (const [gen, campo] of [[prob.problemasReduccionUnidad, "contexto"], [prob.problemasDeProporcionalidad, "contexto"], [con.promociones, "contexto"], [vari.subidaEImpuestos, "contexto"]]) {
        const ids = gen(crearAzar(s), { cuantos: 4 }).apartados.map((a) => a[campo]);
        assert.equal(new Set(ids).size, ids.length, `${s}: ${ids}`);
      }
    }
  });

  test("proporcionalidad/respuestas-trampa: cada error da lo que escribiría el alumno", () => {
    const t = (clave, apartado) => Object.fromEntries(trampasDelApartado(clave, apartado).map((x) => [x.error, x.respuesta]));
    assert.deepEqual(t("razon_simplificada", { solucion: "4/3", alReves: { n: 3, d: 4 } }), { 1: "3/4" });
    assert.deepEqual(t("es_proporcion", { solucion: "no", aditiva: true }), { 2: "sí" });
    assert.deepEqual(t("es_proporcion", { solucion: "sí", aditiva: false }), {});
    assert.deepEqual(t("termino_de_proporcion", { solucion: 12, aditiva: 10 }), { 2: "10" });
    assert.deepEqual(t("completa_tabla_proporcional", { solucion: [30, 12], aditiva: [20, 26] }), { 2: "20, 26" });
    assert.deepEqual(t("problemas_reduccion_unidad", { solucion: "20 €", sinUnidad: "60 €" }), { 3: "60 €" });
    assert.deepEqual(t("porcentaje_fraccion_decimal", { solucion: ["1/20", "0,05"], p: 5 }), { 5: "1/20, 0,5" });
    assert.deepEqual(t("porcentaje_de_cantidad", { solucion: 16, p: 20, q: 80 }), { 4: "4" });
    assert.deepEqual(t("porcentaje_de_cantidad", { solucion: 21, p: 30, q: 70 }), {}, "70 : 30 no es entero");
    assert.deepEqual(t("que_porcentaje_es", { solucion: 20, soloCociente: "0,2" }), { 6: "0,2" });
    assert.deepEqual(t("total_desde_porcentaje", { solucion: 40, deLaParte: "3,6" }), { 7: "3,6" });
    assert.deepEqual(t("rebaja_precio_final", { solucion: "45 €", soloDescuento: "15 €" }), { 8: "15 €" });
    assert.deepEqual(t("subida_e_impuestos", { solucion: "96,80 €", comoEuros: "101 €" }), { 9: "101 €" });
    assert.deepEqual(t("precio_antes", { solucion: "80 €", conError10: "75 €" }), { 10: "75 €" });
    assert.deepEqual(t("mejor_oferta", { solucion: "B", masBaratoEnTotal: "A" }), { 11: "A" });
  });

  test("proporcionalidad/las trampas salen de lo impreso: sumando, sin la unidad, sobre el precio de después", () => {
    for (const a of todos(raz.terminoDeProporcion, 7)) {
      const [p, q, r] = numeros(a.texto);
      const esperada = /\/x/.test(a.texto) ? q + (r - p) : p + (r - q);
      assert.equal(a.aditiva, esperada > 0 ? esperada : null, a.texto);
    }
    for (const a of todos(vari.precioAntes, 4)) {
      const ahora = centimos(a.texto.match(/(\d+(?:,\d{2})?) €/)[0]);
      const p = numeros(a.texto)[0];
      const cambio = (ahora * p) / 100;
      if (!Number.isInteger(cambio)) { assert.equal(a.conError10, null); continue; }
      assert.equal(centimos(a.conError10), /IVA/.test(a.texto) ? ahora - cambio : ahora + cambio, a.texto);
    }
  });

  test("proporcionalidad/todo apartado trae su razón, sin 'undefined', 'NaN' ni precios de una cifra decimal", () => {
    for (const b of Object.values(PROPORCIONALIDAD_1ESO.baterias).flat()) {
      for (const a of todos(b.generador, b.maximo)) {
        assert.ok(a.razon && a.razon.length > 10, `${b.clave}: sin razón`);
        for (const campo of [a.latex, a.latexResuelto, a.texto, a.razon]) {
          assert.ok(!/undefined|NaN|\[object|null/.test(campo), `${b.clave}: ${campo}`);
          assert.ok(!/\d,\d €|\d\.\d/.test(campo), `${b.clave}: ${campo}`);
        }
      }
    }
  });

  test("proporcionalidad/el montador arma una hoja de cada objetivo en las tres intensidades", () => {
    for (const objetivo of objetivosDe(PROPORCIONALIDAD_1ESO)) {
      for (const intensidad of Object.keys(INTENSIDADES)) {
        const { hoja, soluciones } = montaHoja({ tema: PROPORCIONALIDAD_1ESO, objetivo, intensidad, azar: crearAzar(`${objetivo}${intensidad}`) });
        assert.ok(hoja.actividades.length >= 2);
        soluciones.forEach((s, i) => assert.equal(s.respuestas.length, hoja.actividades[i].apartados.length));
      }
    }
  });
}
