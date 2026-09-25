// EL TEMA NÚMEROS DECIMALES: cada respuesta recalculada por otro camino a
// partir de lo que se IMPRIME, con 40 semillas. El otro camino: cada
// decimal del texto se lee aquí como un entero en millonésimas (3,45 →
// 3 450 000), sin importar decimal.js, y se opera con enteros. Si la
// aritmética de decimal.js estuviera mal, comprobarla con ella misma no
// demostraría nada.
export async function run({ test, assert }) {
  const lec = await import("../../server/lib/generadorEjercicios/generadores/decimales/lectura.js");
  const ord = await import("../../server/lib/generadorEjercicios/generadores/decimales/orden.js");
  const sr = await import("../../server/lib/generadorEjercicios/generadores/decimales/sumaResta.js");
  const pc = await import("../../server/lib/generadorEjercicios/generadores/decimales/productoCociente.js");
  const prob = await import("../../server/lib/generadorEjercicios/generadores/decimales/problemas.js");
  const { enLetra } = await import("../../server/lib/generadorEjercicios/generadores/decimales/palabras.js");
  const { crearAzar } = await import("../../server/lib/generadorEjercicios/aleatorio.js");
  const { trampasDelApartado } = await import("../../server/lib/generadorEjercicios/errores/trampasDelApartado.js");
  const { montaHoja, INTENSIDADES } = await import("../../server/lib/generadorEjercicios/montadorDeHoja.js");
  const { objetivosDe } = await import("../../server/lib/generadorEjercicios/catalogoDeBaterias.js");
  const { DECIMALES_1ESO } = await import("../../server/lib/generadorEjercicios/temas/decimales1eso.js");

  const SEMILLAS = Array.from({ length: 40 }, (_, i) => `de${i}`);
  const todos = (gen, cuantos) => SEMILLAS.flatMap((s) => gen(crearAzar(s), { cuantos }).apartados);

  // "3,45" → 3450000 (millonésimas); "65 100" → 65100000000.
  const M = 1_000_000;
  function mill(t) {
    const s = String(t).replace(/ /g, "").replace("−", "-");
    assert.match(s, /^-?\d+(,\d+)?$/, `no es un decimal: "${t}"`);
    const [e, d = ""] = s.replace("-", "").split(",");
    assert.ok(d.length <= 6);
    const v = Number(e) * M + Number(d.padEnd(6, "0"));
    return s.startsWith("-") ? -v : v;
  }
  // Los decimales de un texto, en orden.
  const decimales = (t) => (t.match(/\d[\d ]*\d(?:,\d+)?|\d(?:,\d+)?/g) || []).map(mill);
  // Bien escrito: sin ceros de sobra a la derecha.
  const sinCerosDeSobra = (t) => !/,\d*0$/.test(t);

  test("decimales/valor posicional: la cifra de esa posición, contando detrás de la coma", () => {
    const POS = { décimas: 1, centésimas: 2, milésimas: 3 };
    for (const a of todos(lec.valorPosicional, 8)) {
      const [num, pos] = a.texto.split(": ");
      const cifra = Number(num.split(",")[1][POS[pos.replace(", ___", "")] - 1]);
      assert.equal(a.solucion, cifra, a.texto);
    }
  });

  test("decimales/escribe con cifras: la frase en letra y el número dicen lo mismo, y la mitad llevan ceros", () => {
    const POS = { décimas: 1, centésimas: 2, milésimas: 3 };
    // Del número a la frase, con el enLetra de palabras.js comprobado aparte.
    let conCeros = 0;
    for (const a of todos(lec.escribeConCifras, 6)) {
      const [ent, dec = ""] = a.solucion.split(",");
      const pos = Object.keys(POS).find((k) => a.texto.includes(k));
      assert.equal(dec.length, POS[pos], a.texto);
      const parte = Number(dec);
      const esperado = Number(ent) ? `${enLetra(Number(ent))} unidades y ${enLetra(parte)} ${pos}` : `${enLetra(parte)} ${pos}`;
      assert.equal(a.texto.toLowerCase(), `${esperado}: ___`, a.solucion);
      if (dec.startsWith("0")) conCeros += 1;
    }
    assert.ok(conCeros > SEMILLAS.length, `solo ${conCeros} con ceros`);
  });

  test("decimales/palabras: los números en letra, y los femeninos se evitan", () => {
    assert.equal(enLetra(45), "cuarenta y cinco");
    assert.equal(enLetra(16), "dieciséis");
    assert.equal(enLetra(125), "ciento veinticinco");
    assert.equal(enLetra(100), "cien");
    assert.equal(enLetra(11), "once");
    for (const n of [1, 21, 31, 121, 200]) assert.throws(() => enLetra(n));
  });

  test("decimales/descomponer: la suma de las partes es el número, sin ceros", () => {
    const VALOR = { U: M, d: M / 10, c: M / 100, m: M / 1000 };
    for (const a of todos(lec.descomponDecimal, 6)) {
      const n = mill(a.texto.split(" = ")[0]);
      const partes = a.solucion.split(" + ").map((p) => p.split(" "));
      assert.equal(partes.reduce((s, [c, u]) => s + Number(c) * VALOR[u], 0), n, `${a.texto} → ${a.solucion}`);
      assert.ok(partes.every(([c]) => c !== "0"));
    }
  });

  test("decimales/fracción a decimal: el decimal por el denominador da el numerador", () => {
    for (const a of todos(lec.fraccionYDecimal, 8)) {
      const [n, d] = a.texto.split(" = ")[0].split("/").map(Number);
      assert.equal(mill(a.solucion) * d, n * M, a.texto);
      assert.ok(sinCerosDeSobra(a.solucion), a.solucion);
    }
  });

  test("decimales/comparar: el signo es el de las millonésimas, y el de más cifras NO suele ser mayor", () => {
    let trampas = 0;
    for (const s of SEMILLAS) {
      const { apartados } = ord.comparaDecimales(crearAzar(s), { cuantos: 6 });
      assert.ok(apartados.some((a) => a.solucion === "="), `${s}: sin la pareja 0,5 y 0,50`);
      for (const a of apartados) {
        const [x, y] = a.texto.replace(" ___", "").split(" □ ");
        const sg = Math.sign(mill(x) - mill(y));
        assert.equal(a.solucion, { "-1": "<", 0: "=", 1: ">" }[sg], a.texto);
        const masCifras = (x.split(",")[1] || "").length > (y.split(",")[1] || "").length ? 1 : -1;
        if (x.split(",")[0] === y.split(",")[0] && sg !== 0 && sg !== masCifras) trampas += 1;
      }
    }
    assert.ok(trampas >= SEMILLAS.length * 3, `solo ${trampas} parejas ponen a prueba el error 1`);
  });

  test("decimales/ordenar: de menor a mayor, y ordenar 'por la parte decimal' da otra cosa", () => {
    for (const a of todos(ord.ordenaDecimales, 3)) {
      const lista = a.texto.split(" → ")[0].split("; ");
      const bien = [...lista].sort((p, q) => mill(p) - mill(q));
      assert.deepEqual(a.solucion, bien, a.texto);
      assert.notDeepEqual(a.conError1, a.solucion);
    }
  });

  test("decimales/redondear: el más cercano con esas cifras, escrito con todas", () => {
    const CIFRAS = { "las unidades": 0, "las décimas": 1, "las centésimas": 2 };
    let arriba = 0;
    for (const a of todos(ord.redondeaDecimal, 7)) {
      const [num, resto] = a.texto.split(" a ");
      const k = CIFRAS[resto.replace(": ___", "")];
      const paso = M / 10 ** k;
      const n = mill(num);
      const esperado = Math.floor((n + paso / 2) / paso) * paso;
      assert.equal(mill(a.solucion), esperado, a.texto);
      assert.equal((a.solucion.split(",")[1] || "").length, k, `${a.texto} → ${a.solucion}`);
      if (esperado > n) arriba += 1;
    }
    assert.ok(arriba > 40);
  });

  test("decimales/sumar y restar: exactas, bien escritas y con distinto número de decimales", () => {
    for (const [gen, op] of [[sr.sumaDecimales, (x, y) => x + y], [sr.restaDecimales, (x, y) => x - y]]) {
      for (const a of todos(gen, 8)) {
        const [x, y] = a.texto.replace(" = ___", "").split(/ [+−] /);
        assert.equal(mill(a.solucion), op(mill(x), mill(y)), a.texto);
        assert.ok(mill(a.solucion) > 0 && sinCerosDeSobra(a.solucion), a.solucion);
        assert.notEqual((x.split(",")[1] || "").length, (y.split(",")[1] || "").length, a.texto);
      }
    }
  });

  test("decimales/multiplicar y dividir: exactas; por 10, 100, 1000 moviendo la coma", () => {
    for (const a of todos(pc.porPotenciaDeDiez, 8)) {
      const [x, op, p] = a.texto.replace(" = ___", "").split(" ");
      const r = op === "·" ? mill(x) * Number(p) : mill(x) / Number(p);
      assert.equal(mill(a.solucion), r, a.texto);
    }
    for (const a of todos(pc.multiplicaDecimales, 7)) {
      const [x, y] = a.texto.replace(" = ___", "").split(" · ");
      assert.equal(mill(a.solucion) * M, mill(x) * mill(y), a.texto);
    }
    for (const a of todos(pc.divideDecimales, 7)) {
      const [x, y] = a.texto.replace(" = ___", "").split(" : ");
      assert.equal(mill(a.solucion) * mill(y), mill(x) * M, a.texto);
      assert.ok(sinCerosDeSobra(a.solucion));
    }
  });

  test("decimales/efecto: mayor o menor según el número sea mayor o menor que 1", () => {
    for (const a of todos(pc.efectoDeOperar, 8)) {
      const [, n, op, f] = a.texto.match(/^(\d+) ([·:]) (\S+) es/);
      const r = op === "·" ? Number(n) * mill(f) / M : Number(n) * M / mill(f);
      assert.equal(a.solucion, r > Number(n) ? "mayor" : "menor", a.texto);
    }
  });

  test("decimales/problemas: la respuesta, recalculada desde el enunciado", () => {
    const precio = (t) => mill(t.replace(" €", ""));
    for (const a of todos(prob.problemasCompras, 4)) {
      const d = decimales(a.texto);
      const r = decimales(a.solucion)[0];
      const ok = {
        vuelta: () => d[3] - d[0] - d[1] - d[2] === r && d[3] > d[0] + d[1] + d[2],
        por_kilo: () => d[0] * d[1] / M === r,
        salto: () => d[0] - d[1] === r,
        cuerdas: () => d[0] + d[1] + d[2] === r,
        gasolina: () => d[0] * d[1] / M === r,
      }[a.contexto]();
      assert.ok(ok, `${a.contexto}: ${a.texto} → ${a.solucion}`);
      if (/€/.test(a.solucion)) assert.match(a.solucion, /^\d+(,\d{2})? €$/);
    }
    for (const a of todos(prob.problemasRepartos, 4)) {
      const d = decimales(a.texto);
      const r = decimales(a.solucion)[0];
      const ok = {
        pizza: () => r * d[0] / M === d[1],
        botella: () => r * d[0] / M === d[1],
        etapas: () => r * d[1] / M === d[0],
        cinta: () => r * d[1] / M === d[0],
        precio_unidad: () => r * d[0] / M === d[1],
      }[a.contexto]();
      assert.ok(ok, `${a.contexto}: ${a.texto} → ${a.solucion}`);
      if (["botella", "cinta"].includes(a.contexto)) assert.equal(r % M, 0, `${a.texto}: no sale un número entero de ${a.contexto}`);
    }
    void precio;
  });

  test("decimales/respuestas-trampa: cada error da lo que escribiría el alumno", () => {
    const t = (clave, apartado) => Object.fromEntries(trampasDelApartado(clave, apartado).map((x) => [x.error, x.respuesta]));
    assert.deepEqual(t("compara_decimales", { solucion: ">", conError1: "<" }), { 1: "<" });
    assert.deepEqual(t("escribe_decimal_con_cifras", { solucion: "3,05", sinCeros: "3,5" }), { 2: "3,5" });
    assert.deepEqual(t("fraccion_a_decimal", { solucion: "0,75", comaEnMedio: "3,4", sinCeros: null }), { 10: "3,4" });
    assert.deepEqual(t("fraccion_a_decimal", { solucion: "0,07", comaEnMedio: "7,100", sinCeros: "0,7" }), { 10: "7,100", 2: "0,7" });
    assert.deepEqual(t("redondea_decimal", { solucion: "3,5", cortado: "3,4" }), { 3: "3,4" });
    assert.deepEqual(t("redondea_decimal", { solucion: "3,1", cortado: "3,1" }), {}, "hacia abajo, cortar acierta");
    assert.deepEqual(t("suma_decimales", { solucion: "3,75", alineado: "1,5" }), { 4: "1,5" });
    assert.deepEqual(t("resta_decimales", { solucion: "3,75", alineado: null, bajando: "4,25" }), { 5: "4,25" });
    assert.deepEqual(t("por_potencia_de_diez", { solucion: "34", comaMal: "3,40" }), { 7: "3,40" });
    assert.deepEqual(t("multiplica_decimales", { solucion: "0,06", decimalesDeUno: "0,6" }), { 6: "0,6" });
    assert.deepEqual(t("divide_decimales", { solucion: "20", sinMoverDividendo: "2" }), { 8: "2" });
    assert.deepEqual(t("efecto_de_operar", { solucion: "menor", siempre: "mayor" }), { 9: "mayor" });
  });

  test("decimales/las trampas salen de lo impreso", () => {
    for (const a of todos(sr.sumaDecimales, 8)) {
      const [x, y] = a.texto.replace(" = ___", "").split(" + ");
      const e = Math.max((x.split(",")[1] || "").length, (y.split(",")[1] || "").length);
      const r = Number(x.replace(",", "")) + Number(y.replace(",", ""));
      assert.equal(mill(a.alineado), r * M / 10 ** e, a.texto);
    }
    for (const a of todos(sr.restaDecimales, 8).filter((x) => x.bajando)) {
      const [x, y] = a.texto.replace(" = ___", "").split(" − ");
      const [ye, yd] = y.split(",");
      assert.equal(a.bajando, `${Number(x) - Number(ye)},${yd}`, a.texto);
    }
    for (const a of todos(pc.divideDecimales, 7).filter((x) => x.sinMoverDividendo)) {
      const [x, y] = a.texto.replace(" = ___", "").split(" : ");
      assert.equal(mill(a.sinMoverDividendo) * Number(y.replace(",", "")), mill(x), a.texto);
    }
    for (const a of todos(pc.multiplicaDecimales, 7).filter((x) => x.decimalesDeUno)) {
      assert.notEqual(a.decimalesDeUno, a.solucion);
    }
  });

  test("decimales/todo apartado trae su razón, sin 'undefined', 'NaN' ni '1 lugares'", () => {
    for (const b of Object.values(DECIMALES_1ESO.baterias).flat()) {
      for (const a of todos(b.generador, b.maximo)) {
        assert.ok(a.razon && a.razon.length > 10, `${b.clave}: sin razón`);
        for (const campo of [a.latex, a.latexResuelto, a.texto, a.razon]) {
          assert.ok(!/undefined|NaN|\[object|null|\d\.\d/.test(campo), `${b.clave}: ${campo}`);
          assert.ok(!/\b1 (lugares|décimas|centésimas|milésimas|unidades)/.test(campo), `${b.clave}: ${campo}`);
          assert.ok(!/\d{5}/.test(campo.replace(/,\d+/g, "").replace(/\$[^$]*\$/g, "")), `${b.clave}: número sin agrupar en ${campo}`);
        }
      }
    }
  });

  test("decimales/el montador arma una hoja de cada objetivo en las tres intensidades", () => {
    for (const objetivo of objetivosDe(DECIMALES_1ESO)) {
      for (const intensidad of Object.keys(INTENSIDADES)) {
        const { hoja, soluciones } = montaHoja({ tema: DECIMALES_1ESO, objetivo, intensidad, azar: crearAzar(`${objetivo}${intensidad}`) });
        assert.ok(hoja.actividades.length >= 2);
        soluciones.forEach((s, i) => assert.equal(s.respuestas.length, hoja.actividades[i].apartados.length));
      }
    }
  });
}
