import { readFileSync } from "node:fs";

// EL TEMA ESTADÍSTICA Y PROBABILIDAD: cada respuesta recalculada AQUÍ desde
// lo que se imprime (la lista de datos, la tabla, el diagrama dibujado, el
// enunciado), por un camino distinto al del generador. En probabilidad, los
// casos se cuentan enumerando el dado, la ruleta o la baraja entera.
export async function run({ test, assert }) {
  const datos = await import("../../server/lib/generadorEjercicios/generadores/estadistica/datos.js");
  const gra = await import("../../server/lib/generadorEjercicios/generadores/estadistica/graficos.js");
  const med = await import("../../server/lib/generadorEjercicios/generadores/estadistica/medidas.js");
  const pro = await import("../../server/lib/generadorEjercicios/generadores/estadistica/probabilidad.js");
  const { crearAzar } = await import("../../server/lib/generadorEjercicios/aleatorio.js");
  const { trampasDelApartado } = await import("../../server/lib/generadorEjercicios/errores/trampasDelApartado.js");
  const { ERRORES_ESTADISTICA } = await import("../../server/lib/generadorEjercicios/errores/trampasEstadistica.js");
  const { montaHoja, INTENSIDADES } = await import("../../server/lib/generadorEjercicios/montadorDeHoja.js");
  const { objetivosDe } = await import("../../server/lib/generadorEjercicios/catalogoDeBaterias.js");
  const { ESTADISTICA_1ESO } = await import("../../server/lib/generadorEjercicios/temas/estadistica1eso.js");
  const { Window } = await import("happy-dom");
  const { buildFigura } = await import("../../assets/shared/hoja/js/figuras/index.js");

  const SEMILLAS = Array.from({ length: 40 }, (_, i) => `es${i}`);
  const todos = (gen, cuantos) => SEMILLAS.flatMap((s) => gen(crearAzar(s), { cuantos }).apartados);
  const n = (t) => Number(String(t).replace(",", "."));
  const numeros = (t) => (String(t).match(/\d+(?:,\d+)?/g) || []).map(n);
  const suma = (xs) => xs.reduce((s, x) => s + x, 0);
  // Redondeo a dos decimales con coma, como en una hoja.
  const dos = (x) => String(Math.round(x * 100) / 100).replace(".", ",");
  const listaDelTexto = (t) => t.split(": ")[1].split(".")[0].split(", ").map(n);

  test("estadística/tipo de variable: la que corresponde, y al menos dos de cada tipo", () => {
    const CONTINUAS = /Estatura|Peso|Tiempo|Temperatura|Litros|Longitud|Distancia|Velocidad/;
    const DISCRETAS = /Número|Goles|Libros|veces|Alumnos|Hijos/;
    for (const s of SEMILLAS) {
      const aps = datos.tipoDeVariable(crearAzar(s), { cuantos: 6 }).apartados;
      for (const a of aps) {
        const esperado = CONTINUAS.test(a.texto) ? "cuantitativa continua" : DISCRETAS.test(a.texto) && !/Mes de/.test(a.texto) ? "cuantitativa discreta" : "cualitativa";
        assert.equal(a.solucion, esperado, a.texto);
      }
      for (const t of ["cualitativa", "cuantitativa discreta", "cuantitativa continua"]) {
        assert.ok(aps.filter((a) => a.solucion === t).length >= 2, `${s}: menos de dos ${t}`);
      }
    }
  });

  test("estadística/tabla de frecuencias: contada otra vez desde la lista impresa", () => {
    for (const a of todos(datos.tablaDeFrecuencias, 2)) {
      const lista = a.latex.split(": ")[1].split(".")[0].split(", ").map(Number);
      const f = a.valores.map((v) => lista.filter((x) => x === v).length);
      assert.equal(a.solucion[0], f.join(", "), a.texto);
      assert.equal(a.solucion[1], f.map((x) => `${(x * 100) / lista.length} %`).join(", "));
      assert.ok([20, 25].includes(lista.length));
      assert.equal(suma(f), lista.length, "ningún dato fuera de los valores de la tabla");
    }
  });

  test("estadística/diagrama de barras: cada respuesta sale de lo dibujado", () => {
    for (const a of todos(gra.leeDiagramaBarras, 2)) {
      const { categorias, valores, paso } = a.figura;
      const j = categorias.findIndex((c) => a.texto.includes(`eligieron ${c.toLowerCase()}?`));
      assert.ok(j >= 0, a.texto);
      const max = Math.max(...valores);
      assert.deepEqual(a.solucion, [String(valores[j]), String(suma(valores)), categorias[valores.indexOf(max)].toLowerCase()]);
      assert.equal(valores.filter((v) => v === max).length, 1, "una sola moda");
      assert.ok(valores.every((v) => v % paso === 0), "cada barra acaba en una línea de la cuadrícula");
    }
  });

  test("estadística/ángulos de sectores: proporcionales a las personas y suman 360°", () => {
    for (const a of todos(gra.angulosDeSectores, 3)) {
      const total = numeros(a.texto)[0];
      const f = [...a.texto.matchAll(/: (\d+)/g)].map((m) => Number(m[1]));
      assert.equal(suma(f), total, a.texto);
      const angulos = a.solucion.map((x) => Number(x.replace("°", "")));
      assert.deepEqual(angulos, f.map((x) => (x * 360) / total));
      assert.equal(suma(angulos), 360);
    }
  });

  test("estadística/media, mediana y moda: recalculadas de la lista impresa (la mediana, ORDENANDO)", () => {
    for (const a of todos(med.mediaMedianaModa, 3)) {
      const xs = listaDelTexto(a.texto);
      const o = [...xs].sort((p, q) => p - q);
      const m = o.length % 2 ? o[(o.length - 1) / 2] : (o[o.length / 2 - 1] + o[o.length / 2]) / 2;
      const veces = (v) => xs.filter((x) => x === v).length;
      const moda = o.reduce((best, v) => (veces(v) > veces(best) ? v : best), o[0]);
      assert.deepEqual(a.solucion, [String(suma(xs) / xs.length).replace(".", ","), String(m).replace(".", ","), String(moda)], a.texto);
      assert.ok(Number.isInteger(suma(xs) / xs.length), "media entera");
      assert.equal(o.filter((v) => veces(v) === veces(moda)).filter((v, i, l) => l.indexOf(v) === i).length, 1, "una sola moda");
      assert.notDeepEqual(xs, o, "la lista no viene ordenada (si no, el error 5 no se ve)");
    }
  });

  test("estadística/media de una tabla: Σ valor · frecuencia entre el total, con un decimal como mucho, y sin repetir situación", () => {
    for (const s of SEMILLAS) {
      const aps = med.mediaDeTabla(crearAzar(s), { cuantos: 4 }).apartados;
      assert.equal(new Set(aps.map((a) => a.contexto)).size, aps.length, `${s}: dos tablas de la misma situación`);
    }
    for (const a of todos(med.mediaDeTabla, 3)) {
      const pares = [...a.texto.matchAll(/(\d+) \((\d+) veces\)/g)].map((m) => [Number(m[1]), Number(m[2])]);
      const media = suma(pares.map(([x, f]) => x * f)) / suma(pares.map(([, f]) => f));
      assert.equal(n(a.solucion), media, a.texto);
      assert.ok(Number.isInteger(media * 10), `${media}: más de un decimal`);
    }
  });

  test("estadística/comparar conjuntos: misma media, y más regular el de menos rango", () => {
    for (const a of todos(med.comparaConjuntos, 2)) {
      const [A, B] = [...a.texto.matchAll(/: ([\d, ]+)\./g)].map((m) => m[1].split(", ").map(Number));
      const rango = (xs) => Math.max(...xs) - Math.min(...xs);
      const [mA, mB, rA, rB, quien] = a.solucion;
      assert.equal(Number(mA), suma(A) / 5);
      assert.equal(Number(mB), suma(B) / 5);
      assert.equal(mA, mB, "la media no decide");
      assert.deepEqual([Number(rA), Number(rB)], [rango(A), rango(B)]);
      const nombres = [...a.texto.matchAll(/(\p{Lu}\p{Ll}+): \d/gu)].map((m) => m[1]);
      assert.equal(quien, rango(A) < rango(B) ? nombres[0] : nombres[1], a.texto);
    }
  });

  test("probabilidad/Laplace: los casos se cuentan enumerando dado, ruleta, baraja y bolsa", () => {
    const fr = (f, t) => {
      const m = (x, y) => (y ? m(y, x % y) : x);
      const d = m(f, t);
      return t / d === 1 ? String(f / d) : `${f / d}/${t / d}`;
    };
    const PALOS = ["oros", "copas", "espadas", "bastos"];
    const BARAJA = PALOS.flatMap((p) => [1, 2, 3, 4, 5, 6, 7, 10, 11, 12].map((v) => ({ p, v })));
    const primo = (x) => [2, 3, 5, 7, 11].includes(x);
    for (const a of todos(pro.probabilidadLaplace, 4)) {
      const t = a.texto;
      let fav;
      let total;
      if (t.startsWith("Se lanza un dado") || t.startsWith("Una ruleta")) {
        total = t.startsWith("Se lanza") ? 6 : numeros(t)[0];
        const caras = Array.from({ length: total }, (_, i) => i + 1);
        const k = numeros(t.split("salga")[1])[0];
        const p = /par/.test(t) ? (x) => x % 2 === 0 : /múltiplo de 3/.test(t) ? (x) => x % 3 === 0 : /múltiplo de 4/.test(t) ? (x) => x % 4 === 0
          : /mayor que/.test(t) ? (x) => x > k : /menor que/.test(t) ? (x) => x < k : /primo/.test(t) ? primo : (x) => x === k;
        fav = caras.filter(p).length;
      } else if (/baraja/.test(t)) {
        total = 40;
        const p = /de oros/.test(t) ? (c) => c.p === "oros" : /un as/.test(t) ? (c) => c.v === 1 : /figura/.test(t) ? (c) => c.v >= 10
          : /rey de copas/.test(t) ? (c) => c.v === 12 && c.p === "copas" : (c) => c.p !== "espadas";
        fav = BARAJA.filter(p).length;
      } else {
        const bolas = [...t.matchAll(/(\d+) (rojas|azules|verdes|amarillas)/g)].map((m) => ({ c: m[2], k: Number(m[1]) }));
        total = suma(bolas.map((b) => b.k));
        const color = { roja: "rojas", azul: "azules", verde: "verdes", amarilla: "amarillas" }[t.match(/sea (\w+)\?/)[1]];
        const k = bolas.find((b) => b.c === color).k;
        fav = /NO sea/.test(t) ? total - k : k;
      }
      assert.equal(a.solucion, fr(fav, total), t);
    }
  });

  test("probabilidad/frecuencia relativa: veces entre veces, y la decisión que corresponde", () => {
    for (const a of todos(pro.frecuenciaRelativa, 2)) {
      const [veces, sale] = a.contexto === "tiros" ? numeros(a.texto).slice(0, 2) : [...a.texto.matchAll(/(\d+) veces/g)].map((m) => Number(m[1]));
      const f = sale / veces;
      assert.equal(a.solucion[0], dos(f), a.texto);
      if (a.contexto === "dado") assert.equal(a.solucion[1], Math.abs(f - 1 / 6) < 0.05 ? "sí" : "no");
      else assert.equal(a.solucion[1], dos(1 - f));
    }
  });

  test("estadística/respuestas-trampa: cada error da lo que escribiría el alumno", () => {
    const t = (clave, ap) => Object.fromEntries(trampasDelApartado(clave, ap).map((x) => [x.error, x.respuesta]));
    assert.deepEqual(t("tipo_de_variable", { solucion: "cuantitativa continua", cambiada: "cuantitativa discreta" }), { 1: "cuantitativa discreta" });
    assert.deepEqual(t("tipo_de_variable", { solucion: "cualitativa", cambiada: null }), {});
    assert.deepEqual(t("tabla_de_frecuencias", { solucion: ["4, 16", "20 %, 80 %"], porcentajeComoFrecuencia: ["4, 16", "4 %, 16 %"] }), { 2: "4, 16, 4 %, 16 %" });
    assert.deepEqual(t("lee_diagrama_barras", { solucion: ["8", "32", "naranja"], modaComoFrecuencia: ["8", "32", "12"] }), { 3: "8, 32, 12" });
    assert.deepEqual(t("angulos_de_sectores", { solucion: ["90°", "270°"], porcentajeComoAngulo: ["25°", "75°"] }), { 4: "25°, 75°" });
    assert.deepEqual(t("media_mediana_moda", { solucion: ["4", "5", "6"], sinOrdenar: ["4", "3", "6"], modaComoFrecuencia: ["4", "5", "3"] }), { 5: "4, 3, 6", 3: "4, 5, 3" });
    assert.deepEqual(t("media_de_tabla", { solucion: "1,7", sinFrecuencias: "1,5" }), { 6: "1,5" });
    assert.deepEqual(t("compara_conjuntos", { solucion: ["15", "15", "2", "10", "Ana"], alReves: ["15", "15", "2", "10", "Luis"] }), { 7: "15, 15, 2, 10, Luis" });
    assert.deepEqual(t("probabilidad_laplace", { solucion: "1/5", entreDesfavorables: "1/4", entreColores: "1/3" }), { 8: "1/4", 9: "1/3" });
    assert.deepEqual(t("frecuencia_relativa", { solucion: ["0,17", "sí"], absoluta: ["102", "sí"] }), { 10: "102, sí" });
    // Y con los generadores de verdad: cada error predecible sale en alguna hoja.
    const vistos = new Set();
    for (const b of Object.values(ESTADISTICA_1ESO.baterias).flat()) {
      for (const a of todos(b.generador, b.maximo)) trampasDelApartado(b.clave, a).forEach((x) => vistos.add(x.error));
    }
    assert.deepEqual([...vistos].sort((p, q) => p - q), ERRORES_ESTADISTICA.map((e) => e.numero));
  });

  test("estadística/los errores del código son los de la migración 150, con su id", () => {
    const sql = readFileSync(new URL("../../supabase/migrations/150_semilla_estadistica_1eso.sql", import.meta.url), "utf8");
    for (const e of ERRORES_ESTADISTICA) assert.ok(sql.includes(`'${e.id}'`), `${e.numero}: ${e.id} no está en la migración`);
  });

  test("estadística/las figuras se pueden dibujar y todo apartado trae su razón", () => {
    const w = globalThis.window || new Window();
    for (const b of Object.values(ESTADISTICA_1ESO.baterias).flat()) {
      for (const a of todos(b.generador, b.maximo)) {
        assert.ok(a.razon && a.razon.length > 10, `${b.clave}: sin razón`);
        for (const campo of [a.latex, a.latexResuelto, a.texto, a.razon]) assert.ok(!/undefined|NaN|\[object|null|\d\.\d/.test(campo), `${b.clave}: ${campo}`);
        // Un hueco de tabla mal escrito se imprimía «;;;;» (1/10/2026).
        assert.ok(!/(^|[^\\]);;/.test(a.latex), `${b.clave}: hueco roto en ${a.latex}`);
        if (a.figura) assert.ok(buildFigura(a.figura, w.document), `${b.clave}: la figura no se puede dibujar`);
      }
    }
  });

  test("estadística/el montador arma una hoja de cada objetivo en las tres intensidades", () => {
    for (const objetivo of objetivosDe(ESTADISTICA_1ESO)) {
      for (const intensidad of Object.keys(INTENSIDADES)) {
        const { hoja, soluciones } = montaHoja({ tema: ESTADISTICA_1ESO, objetivo, intensidad, azar: crearAzar(`${objetivo}${intensidad}`) });
        assert.ok(hoja.actividades.length >= 2, `objetivo ${objetivo} ${intensidad}: ${hoja.actividades.length} actividad`);
        soluciones.forEach((s, i) => assert.equal(s.respuestas.length, hoja.actividades[i].apartados.length));
      }
    }
  });
}
