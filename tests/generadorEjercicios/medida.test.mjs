// EL TEMA SISTEMA MÉTRICO DECIMAL: cada respuesta recalculada por otro
// camino a partir de lo que se IMPRIME, con 40 semillas. El otro camino:
// una tabla de cuántas unidades básicas vale cada unidad (1 km = 1000 m,
// 1 hm² = 10 000 m²…), escrita aquí, y los números leídos en millonésimas
// enteras, sin importar unidades.js ni decimal.js.
export async function run({ test, assert }) {
  const est = await import("../../server/lib/generadorEjercicios/generadores/medida/estimacion.js");
  const cam = await import("../../server/lib/generadorEjercicios/generadores/medida/cambios.js");
  const com = await import("../../server/lib/generadorEjercicios/generadores/medida/complejas.js");
  const prob = await import("../../server/lib/generadorEjercicios/generadores/medida/problemas.js");
  const { crearAzar } = await import("../../server/lib/generadorEjercicios/aleatorio.js");
  const { trampasDelApartado } = await import("../../server/lib/generadorEjercicios/errores/trampasDelApartado.js");
  const { montaHoja, INTENSIDADES } = await import("../../server/lib/generadorEjercicios/montadorDeHoja.js");
  const { objetivosDe } = await import("../../server/lib/generadorEjercicios/catalogoDeBaterias.js");
  const { MEDIDA_1ESO } = await import("../../server/lib/generadorEjercicios/temas/medida1eso.js");

  const SEMILLAS = Array.from({ length: 40 }, (_, i) => `me${i}`);
  const todos = (gen, cuantos) => SEMILLAS.flatMap((s) => gen(crearAzar(s), { cuantos }).apartados);

  // Cuántas milésimas de la unidad básica (mm, mg, mL; mm² aparte) vale
  // cada unidad. En enteros, para comparar sin coma flotante.
  const VALE = {
    km: 1e6, hm: 1e5, dam: 1e4, m: 1e3, dm: 1e2, cm: 10, mm: 1,
    kg: 1e6, hg: 1e5, dag: 1e4, g: 1e3, dg: 1e2, cg: 10, mg: 1,
    kL: 1e6, hL: 1e5, daL: 1e4, L: 1e3, dL: 1e2, cL: 10, mL: 1,
    "km²": 1e12, "hm²": 1e10, "dam²": 1e8, "m²": 1e6, "dm²": 1e4, "cm²": 1e2, "mm²": 1,
    ha: 1e10, a: 1e8,
  };
  // "3,5" → [35, 1] (entero y decimales), para multiplicar sin perder nada.
  function lee(t) {
    const s = String(t).replace(/ /g, "");
    assert.match(s, /^\d+(,\d+)?$/, `no es un número: "${t}"`);
    const d = (s.split(",")[1] || "").length;
    return [BigInt(s.replace(",", "")), d];
  }
  // La medida en la unidad mínima, como fracción exacta [num, 10^d].
  const enMinima = (t, u) => { const [n, d] = lee(t); return [n * BigInt(VALE[u]), 10n ** BigInt(d)]; };
  const iguales = ([a, b], [c, d]) => a * d === c * b;

  test("medida/cambio de unidad: la misma medida en las dos unidades", () => {
    for (const gen of [cam.cambioDeUnidad, cam.cambioDeSuperficie]) {
      for (const a of todos(gen, 8)) {
        const [, n, de, a2] = a.texto.match(/^(\S+(?: \d{3})*) (\S+) = ___ (\S+)$/);
        assert.ok(iguales(enMinima(n, de), enMinima(a.solucion, a2)), `${a.texto} → ${a.solucion}`);
        assert.ok(!/,\d*0$/.test(a.solucion), "sin ceros de sobra");
      }
    }
  });

  test("medida/comparar: el signo es el de las medidas en la misma unidad, y casi siempre el número engaña", () => {
    let engana = 0;
    for (const a of todos(cam.comparaMedidas, 7)) {
      const N = "(\\d{1,3}(?: \\d{3})+|\\S+)";
      const [, x, ux, y, uy] = a.texto.match(new RegExp(`^${N} (\\S+) □ ${N} (\\S+) ___$`));
      const [p, q] = [enMinima(x, ux), enMinima(y, uy)];
      const s = p[0] * q[1] > q[0] * p[1] ? ">" : "<";
      assert.equal(a.solucion, s, a.texto);
      const numeros = Number(x.replace(",", ".")) > Number(y.replace(",", ".")) ? ">" : "<";
      if (numeros !== s) engana += 1;
    }
    assert.ok(engana > 60, `solo ${engana} parejas en las que comparar los números falla`);
  });

  test("medida/forma compleja: la suma de las partes, en la unidad que se pide", () => {
    for (const a of todos(com.aFormaIncompleja, 6)) {
      const [izq, der] = a.texto.split(" = ___ ");
      const partes = izq.match(/\d+ \S+/g).map((p) => p.split(" "));
      const total = partes.reduce((s, [n, u]) => s + Number(n) * VALE[u], 0);
      assert.equal(Number(a.solucion.replace(/ /g, "")) * VALE[der], total, a.texto);
      assert.notEqual(a.juntando, a.solucion, "juntar las cifras no puede acertar");
    }
    for (const a of todos(com.sumaDeMedidas, 6)) {
      const [, x, ux, y, uy, ur] = a.texto.match(/^(\S+) (\S+) \+ (\S+) (\S+) = ___ (\S+)$/);
      const [p, q] = [enMinima(x, ux), enMinima(y, uy)];
      const r = enMinima(a.solucion, ur);
      assert.ok(iguales([p[0] * q[1] + q[0] * p[1], p[1] * q[1]], r), `${a.texto} → ${a.solucion}`);
    }
  });

  test("medida/agrarias: hectáreas y áreas son hm² y dam²", () => {
    for (const a of todos(cam.medidasAgrarias, 4)) {
      const [, n, u] = a.texto.match(/mide (\S+(?: \d{3})*) (ha|a|m²)\./);
      const [rn, ru] = [a.solucion.replace(/ (ha|a|m²)$/, ""), a.solucion.match(/(ha|a|m²)$/)[1]];
      assert.ok(iguales(enMinima(n, u), enMinima(rn, ru)), `${a.texto} → ${a.solucion}`);
      assert.match(a.texto, ru === "m²" ? /¿Cuántos m² son\?/ : /¿Cuántas (hectáreas|áreas) son\?/);
    }
  });

  test("medida/elegir y estimar: la respuesta está entre las opciones, y en estimar las otras son ×10 y :10", () => {
    for (const a of todos(est.unidadAdecuada, 8)) {
      const opciones = a.texto.split(": ")[1].replace(" → ___", "").split(", ");
      assert.ok(opciones.includes(a.solucion), a.texto);
    }
    for (const a of todos(est.estimaMedida, 6)) {
      const opciones = a.texto.split(": ")[1].replace(" → ___", "").split(" / ");
      assert.ok(opciones.includes(a.solucion), a.texto);
      const v = opciones.map((o) => Number(o.split(" ")[0].replace(",", "."))).sort((p, q) => p - q);
      assert.ok(Math.abs(v[1] / v[0] - 10) < 1e-9 && Math.abs(v[2] / v[1] - 10) < 1e-9, a.texto);
      assert.equal(Number(a.solucion.split(" ")[0].replace(",", ".")), v[1], "la razonable es la de en medio");
    }
  });

  test("medida/problemas: la respuesta, recalculada en la unidad mínima", () => {
    for (const a of todos(prob.problemasDeMedida, 4)) {
      const t = a.texto;
      const n = (re) => Number(t.match(re)[1].replace(",", "."));
      const ok = {
        vasos: () => n(/vasos de (\d+) mL/) * Number(a.solucion) === n(/garrafa de (\S+) L/) * 1000,
        vueltas: () => n(/mide (\d+) m/) * Number(a.solucion) === Math.round(n(/correr (\S+) km/) * 1000),
        paquetes: () => n(/paquetes de (\d+) g/) * Number(a.solucion) === Math.round(n(/reparten (\S+) kg/) * 1000),
        cuerda: () => n(/cuerda de (\d+) m/) * 100 - n(/se cortan (\d+) trozos/) * n(/trozos de (\d+) cm/) === Number(a.solucion.split(" ")[0]),
        botellas: () => Math.round(n(/Se llenan (\d+)/) * n(/de (\d+) cL/)) === Math.round(Number(a.solucion.split(" ")[0].replace(",", ".")) * 100),
      }[a.contexto]();
      assert.ok(ok, `${a.contexto}: ${t} → ${a.solucion}`);
    }
  });

  test("medida/problemas de dos pasos: la respuesta, recalculada", () => {
    for (const a of todos(prob.problemasDosPasos, 4)) {
      const t = a.texto;
      const n = (re) => Number(t.match(re)[1].replace(",", "."));
      const r = Number(a.solucion.split(" ")[0].replace(",", "."));
      const ok = {
        queso: () => Math.abs(n(/cuesta (\d+) €/) * n(/cuestan (\d+) g/) / 1000 - r) < 1e-9,
        fuga: () => Math.abs(n(/gotea (\d+) mL/) * 60 * n(/en (\d+) horas/) / 1000 - r) < 1e-9,
        cafe: () => Math.abs(n(/cuesta (\S+) €/) * 1000 / n(/de (\d+) g/) - r) < 1e-9,
        folios: () => Math.abs(n(/pesa (\S+) kg/) * 1000 / n(/de (\d+) folios/) - r) < 1e-9,
        tela: () => Math.abs(n(/cuesta (\d+) €/) * n(/cuestan (\d+) cm/) / 100 - r) < 1e-9,
      }[a.contexto]();
      assert.ok(ok, `${a.contexto}: ${t} → ${a.solucion}`);
      if (/€/.test(a.solucion)) assert.match(a.solucion, /^\d+(,\d{2})? €$/);
    }
  });

  test("medida/respuestas-trampa: cada error da lo que escribiría el alumno", () => {
    const t = (clave, apartado) => Object.fromEntries(trampasDelApartado(clave, apartado).map((x) => [x.error, x.respuesta]));
    assert.deepEqual(t("cambio_de_unidad", { solucion: "3500", alReves: "0,0035", escalonDeMenos: "350" }), { 1: "0,0035", 2: "350" });
    assert.deepEqual(t("cambio_de_superficie", { solucion: "200", comoLongitud: "20", alReves: "0,02" }), { 3: "20", 1: "0,02" });
    assert.deepEqual(t("suma_de_medidas", { solucion: "2850", sinPasar: "352,5" }), { 4: "352,5" });
    assert.deepEqual(t("compara_medidas", { solucion: ">", soloNumeros: "<" }), { 5: "<" });
    assert.deepEqual(t("a_forma_incompleja", { solucion: "3405", juntando: "345" }), { 6: "345" });
  });

  test("medida/las trampas salen de lo impreso", () => {
    // x · mx == y · my, con x e y leídos del folio (fracciones exactas).
    const cumple = (x, mx, y, my) => { const [a, da] = lee(x); const [b, db] = lee(y); return a * BigInt(mx) * 10n ** BigInt(db) === b * BigInt(my) * 10n ** BigInt(da); };
    const partes = (a) => a.texto.match(/^(\S+(?: \d{3})*) (\S+) = ___ (\S+)$/).slice(1);
    for (const a of todos(cam.cambioDeUnidad, 8)) {
      const [n, de, a2] = partes(a);
      // Al revés: el factor de la escalera aplicado hacia el otro lado.
      assert.ok(cumple(a.alReves, VALE[de], n, VALE[a2]), `${a.texto}: ${a.alReves}`);
      // Un escalón de menos: diez veces menos lejos que la respuesta buena.
      if (a.escalonDeMenos) {
        const haciaAbajo = VALE[de] > VALE[a2];
        assert.ok(cumple(a.escalonDeMenos, haciaAbajo ? 10 : 1, a.solucion, haciaAbajo ? 1 : 10), `${a.texto}: ${a.solucion} y ${a.escalonDeMenos}`);
      }
    }
    for (const a of todos(cam.cambioDeSuperficie, 7)) {
      // Como en longitud: la coma, un lugar por escalón y no dos.
      const [n, de, a2] = partes(a);
      const escalones = Math.round(Math.log10(VALE[de] / VALE[a2]) / 2);
      const f = 10 ** Math.abs(escalones);
      assert.ok(escalones > 0 ? cumple(a.comoLongitud, 1, n, f) : cumple(a.comoLongitud, f, n, 1), `${a.texto}: ${a.comoLongitud}`);
    }
    for (const a of todos(com.sumaDeMedidas, 6)) {
      const [, x, , y] = a.texto.match(/^(\S+) (\S+) \+ (\S+) (\S+) =/);
      const [p, q] = [lee(x), lee(y)];
      const esperado = Number(p[0]) / 10 ** p[1] + Number(q[0]) / 10 ** q[1];
      assert.equal(Number(a.sinPasar.replace(",", ".")), Math.round(esperado * 1000) / 1000, a.texto);
    }
  });

  test("medida/todo apartado trae su razón, sin 'undefined', 'NaN' ni '1 escalones'", () => {
    for (const b of Object.values(MEDIDA_1ESO.baterias).flat()) {
      for (const a of todos(b.generador, b.maximo)) {
        assert.ok(a.razon && a.razon.length > 10, `${b.clave}: sin razón`);
        for (const campo of [a.latex, a.latexResuelto, a.texto, a.razon]) {
          assert.ok(!/undefined|NaN|\[object|null|\d\.\d/.test(campo), `${b.clave}: ${campo}`);
          assert.ok(!/\b1 (escalones|lugares)/.test(campo), `${b.clave}: ${campo}`);
          assert.ok(!/\d{5}/.test(campo.replace(/,\d+/g, "").replace(/\$[^$]*\$/g, "")), `${b.clave}: número sin agrupar en ${campo}`);
        }
      }
    }
  });

  test("medida/el montador arma una hoja de cada objetivo en las tres intensidades", () => {
    for (const objetivo of objetivosDe(MEDIDA_1ESO)) {
      for (const intensidad of Object.keys(INTENSIDADES)) {
        const { hoja, soluciones } = montaHoja({ tema: MEDIDA_1ESO, objetivo, intensidad, azar: crearAzar(`${objetivo}${intensidad}`) });
        assert.ok(hoja.actividades.length >= 2);
        soluciones.forEach((s, i) => assert.equal(s.respuestas.length, hoja.actividades[i].apartados.length));
      }
    }
  });
}
