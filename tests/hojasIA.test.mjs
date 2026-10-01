import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

// HOJAS ESCRITAS POR LA IA (server/lib/hojasIA/) y el verificador que no se
// cree lo que escribe (server/lib/verificador/).
const DATOS = new URL("../server/lib/ejerciciosReferencia/datos/", import.meta.url).pathname;
const archivos = (dir) => readdirSync(dir).flatMap((f) => {
  const p = join(dir, f);
  return statSync(p).isDirectory() ? archivos(p) : [p];
});

export async function run({ test }) {
  const { comprueba } = await import("../server/lib/verificador/comprobaciones.js");
  const { lee } = await import("../server/lib/verificador/expresionDeTexto.js");
  const { generaHojaIA, DE_MAS } = await import("../server/lib/hojasIA/generaHojaIA.js");
  const { solucionDice } = await import("../server/lib/hojasIA/verificaEjercicioIA.js");
  const { createApp } = await import("../server/app.js");

  test("DOS VERIFICADORES, UN RESULTADO: todo lo que sympy comprobó en las referencias cuadra aquí", () => {
    let n = 0;
    for (const f of archivos(DATOS)) {
      for (const e of JSON.parse(readFileSync(f, "utf8")).ejercicios) {
        for (const c of e.comprobar || []) {
          n += 1;
          const r = comprueba(c);
          assert.ok(r.ok, `${e.id} ${c.apartado || ""}: ${r.motivo}`);
        }
      }
    }
    assert.ok(n > 400, `solo ${n} comprobaciones`);
  });

  test("y lo que está mal, sale mal", () => {
    const mal = [
      { tipo: "ecuacion", ecuacion: "2*x-5 = 4*x-7", respuesta: ["2"] },
      { tipo: "ecuacion", ecuacion: "x^2-5*x+6 = 0", respuesta: ["3"] }, // falta el 2
      { tipo: "ecuacion", ecuacion: "2*x+1 = 2*x+3", respuesta: "identidad" }, // es sin solución
      { tipo: "ecuacion", ecuacion: "x^2+1 = 0", respuesta: ["1"] },
      { tipo: "sistema", ecuaciones: ["x+y = 10", "x-y = 2"], vars: ["x", "y"], respuesta: { x: "5", y: "5" } },
      { tipo: "sistema", ecuaciones: ["x+y = 1", "2*x+2*y = 3"], vars: ["x", "y"], respuesta: "infinitas" }, // es sin solución
      { tipo: "igualdad", expresion: "(a+b)^2", respuesta: "a^2+b^2" },
      { tipo: "valor", expresion: "3*10^2-5*sqrt(64)+7^0", respuesta: "260" },
      { tipo: "estadistica", datos: [1, 1, 2], medida: "moda", respuesta: ["1", "2"] },
      { tipo: "ecuacion", ecuacion: "2x = 4", respuesta: ["2"] }, // "2x" no se acepta
      { tipo: "inventado", respuesta: "1" },
    ];
    for (const c of mal) assert.equal(comprueba(c).ok, false, JSON.stringify(c));
    assert.equal(comprueba({ tipo: "ecuacion", ecuacion: "x^2-5*x+6 = 0", respuesta: ["2", "3"] }).ok, true);
    assert.equal(comprueba({ tipo: "sistema", ecuaciones: ["x+y = 1", "2*x+2*y = 3"], vars: ["x", "y"], respuesta: "sin solución" }).ok, true);
    assert.equal(lee("-3^2").op, "neg", "-3² es -(3²)");
  });

  test("la solución escrita tiene que decir el resultado (fracción, decimal o LaTeX)", () => {
    assert.equal(solucionDice("$x = \\frac{3}{2}$", "3/2"), true);
    assert.equal(solucionDice("x = 1,5", "3/2"), true);
    assert.equal(solucionDice("x = 2", "3/2"), false);
    assert.equal(solucionDice("165 kg", "165"), true);
  });

  // Una IA falsa que devuelve lo que se le diga y guarda lo que se le pidió.
  function iaQueDevuelve(ejercicios) {
    const llamadas = [];
    return {
      llamadas,
      messages: { create: async (p) => { llamadas.push(p); return { content: [{ type: "tool_use", name: "escribir_hoja", input: { ejercicios } }], usage: { input_tokens: 1, output_tokens: 1 } }; } },
    };
  }
  const bueno = (extra = {}) => ({
    tipo: "ejercicio", subtipo: "ecuaciones con paréntesis", dificultad: 2, saber: "D.4",
    enunciado: "Resuelve:", apartados: ["$3(x - 1) = 2x + 4$"], solucion: "$x = 7$",
    comprobar: [{ tipo: "ecuacion", apartado: "a", ecuacion: "3*(x-1) = 2*x+4", respuesta: ["7"] }], ...extra,
  });

  test("LA HOJA: pasa lo comprobado; se tira lo que no cuadra, lo copiado y lo que se sale del tema", async () => {
    const ia = iaQueDevuelve([
      bueno(),
      bueno({ apartados: ["$5x = 20$"], dificultad: 1, comprobar: [{ tipo: "ecuacion", ecuacion: "5*x = 20", respuesta: ["5"] }], solucion: "$x = 5$" }), // mal: es 4
      bueno({ apartados: ["$x = 2$"], saber: "E.1", comprobar: [{ tipo: "ecuacion", ecuacion: "x = 2", respuesta: ["2"] }], solucion: "2" }), // saber de otro tema
      bueno({ apartados: ["$2x - 5 = 4x - 7$"], comprobar: [{ tipo: "ecuacion", ecuacion: "2*x-5 = 4*x-7", respuesta: ["1"] }], solucion: "$x = 1$" }), // cuenta de una referencia (Marea Verde, cap. 10, ej. 13a)
      bueno({ tipo: "problema", apartados: undefined, enunciado: "El triple de un número menos 3 es su doble más 4. ¿Qué número es?", comprobar: [{ tipo: "ecuacion", ecuacion: "3*(x-1) = 2*x+4", respuesta: ["7"] }], solucion: "El número es 8" }), // un problema: la solución escrita no dice 7
      { tipo: "problema", subtipo: "problema de edades", dificultad: 3, saber: "D.2", enunciado: "Inventa un problema que se resuelva con $x + 3 = 10$.", solucion: "Abierto" }, // sin comprobar
      bueno({ dificultad: 1, apartados: ["$4x - 1 = 11$"], comprobar: [{ tipo: "ecuacion", ecuacion: "4*x-1 = 11", respuesta: ["3"] }], solucion: "$x = 3$" }),
    ]);
    const r = await generaHojaIA({ client: ia, model: "m", etapa: "eso", materia: "matematicas", curso: 2, tema: "ecuaciones-primer-grado", cuantos: 3 });
    assert.equal(r.hoja.actividades.length, 3);
    assert.deepEqual(r.huecos.map((h) => h.verificacion), ["comprobada", "comprobada", "sin_verificar"], "primero los comprobados, de menos a más difícil");
    assert.deepEqual(r.huecos.map((h) => h.orden), [1, 2, 3]);
    assert.equal(r.hoja.actividades[2].tipo, "problema");
    assert.equal(r.hoja.actividades[2].lineas, 4, "un problema lleva espacio para escribir");
    assert.equal(r.hoja.curso, "2.º ESO");
    const motivos = r.descartes.map((d) => d.motivo).join(" | ");
    for (const m of ["no cuadra", "fuera del tema", "referencia", "no dice 7"]) assert.match(motivos, new RegExp(m));
    // Lo que se le da a la IA: los saberes literales de Aragón y referencias.
    const p = ia.llamadas[0];
    assert.deepEqual(p.thinking, { type: "adaptive" }, "piensa antes de escribir");
    assert.equal(p.tool_choice.type, "auto", "con pensamiento no se puede obligar a usar la herramienta");
    assert.ok(p.max_tokens > 8000 && p.max_tokens <= 21333, "sitio para pensar, sin pasar del límite sin streaming");
    assert.match(p.messages[0].content, /D\.4 Igualdad y desigualdad: .*Estrategias de búsqueda de soluciones en ecuaciones/);
    assert.match(p.messages[0].content, /EJERCICIOS DE REFERENCIA/);
    assert.match(p.messages[0].content, new RegExp(`ESCRIBE ${3 + DE_MAS} ejercicios`));
    assert.match(p.system, /Matemáticas de 2\.º ESO/);
  });

  const { solucionDeApartados, latexDeTexto } = await import("../server/lib/hojasIA/solucionDeApartados.js");
  const tresApartados = (respuestaB) => bueno({
    apartados: ["$2x = 6$", "$x + 5 = 9$", "$3x - 3 = 12$"],
    solucion: "a) 3; b) 4; c) 5",
    comprobar: [
      { tipo: "ecuacion", apartado: "a", ecuacion: "2*x = 6", respuesta: ["3"] },
      { tipo: "ecuacion", apartado: "b", ecuacion: "x+5 = 9", respuesta: [respuestaB] },
      { tipo: "ecuacion", apartado: "c", ecuacion: "3*x-3 = 12", respuesta: ["5"] },
    ],
  });

  test("UN APARTADO MAL NO TIRA EL EJERCICIO: se quita ese apartado y la solución la escribe el código", async () => {
    // Prueba real del 30/9: 3 de 8 ejercicios tirados enteros por un apartado cada uno.
    const ia = iaQueDevuelve([tresApartados("8")]); // b) es 4, no 8
    const r = await generaHojaIA({ client: ia, model: "m", etapa: "eso", materia: "matematicas", curso: 2, tema: "ecuaciones-primer-grado", cuantos: 1 });
    assert.equal(r.hoja.actividades.length, 1, "el ejercicio sigue");
    assert.deepEqual(r.hoja.actividades[0].apartados, ["$2x = 6$", "$3x - 3 = 12$"], "sin el apartado malo");
    assert.deepEqual(r.huecos[0].comprobar.map((c) => c.apartado), ["a", "b"], "las letras se vuelven a poner");
    assert.equal(r.huecos[0].solucion, "a) $x = 3$; b) $x = 5$", "la solución sale de lo comprobado, no de la IA");
    assert.match(r.descartes.map((d) => d.motivo).join(), /apartado quitado: b\)/, "y se dice qué se quitó");
  });

  test("…pero si no cuadra ninguno, fuera; y la solución de la IA que contradice lo comprobado no llega", async () => {
    const todoMal = bueno({ apartados: ["$2x = 6$"], comprobar: [{ tipo: "ecuacion", apartado: "a", ecuacion: "2*x = 6", respuesta: ["4"] }] });
    const contradice = { ...tresApartados("4"), solucion: "a) 3; b) 4; c) 6" };
    const r = await generaHojaIA({ client: iaQueDevuelve([todoMal, contradice]), model: "m", etapa: "eso", materia: "matematicas", curso: 2, tema: "ecuaciones-primer-grado", cuantos: 1 });
    assert.match(r.descartes[0].motivo, /ningún apartado cuadra/);
    assert.equal(r.huecos[0].solucion, "a) $x = 3$; b) $x = 4$; c) $x = 5$", "la «c) 6» de la IA no llega: la escribe el código");
  });

  test("…y si la solución de la IA dice todo lo comprobado y no se quitó nada, se queda (lleva unidades y pasos)", async () => {
    const piscina = bueno({ tipo: "problema", enunciado: "Una piscina de 10 m × 5 m × 2 m.", apartados: ["¿Cuántos litros caben?", "¿Cuántos minutos tarda un grifo de 500 l/min?"],
      solucion: "a) 10·5·2 = 100 m³ = 100000 litros; b) 100000 : 500 = 200 minutos",
      comprobar: [{ tipo: "valor", apartado: "a", expresion: "10*5*2*1000", respuesta: "100000" }, { tipo: "valor", apartado: "b", expresion: "100000/500", respuesta: "200" }] });
    const r = await generaHojaIA({ client: iaQueDevuelve([piscina]), model: "m", etapa: "eso", materia: "matematicas", curso: 2, tema: "ecuaciones-primer-grado", cuantos: 1 });
    assert.equal(r.huecos[0].solucion, "a) 10·5·2 = 100 m³ = 100000 litros; b) 100000 : 500 = 200 minutos");
  });

  test("SI FALTAN EJERCICIOS, UNA segunda llamada pide los que faltan (y no más de una)", async () => {
    const llamadas = [];
    const rondas = [[bueno(), bueno({ saber: "Z.9" })], [tresApartados("4")], [bueno()]];
    const ia = { messages: { create: async (p) => { llamadas.push(p); return { content: [{ type: "tool_use", name: "escribir_hoja", input: { ejercicios: rondas[llamadas.length - 1] } }], usage: { input_tokens: 10, output_tokens: 5 } }; } } };
    const r = await generaHojaIA({ client: ia, model: "m", etapa: "eso", materia: "matematicas", curso: 2, tema: "ecuaciones-primer-grado", cuantos: 4 });
    assert.equal(llamadas.length, 2, "dos llamadas, no tres aunque sigan faltando");
    assert.match(llamadas[1].messages[0].content, new RegExp(`ESCRIBE ${3 + DE_MAS} ejercicios`), "pide los 3 que faltan y los de más");
    assert.match(llamadas[1].messages[0].content, /ya tiene ejercicios de estos tipos; escribe de otros: ecuaciones con paréntesis/);
    assert.equal(r.hoja.actividades.length, 2, "una hoja más corta antes que un bucle");
    assert.deepEqual(r.usage, { input_tokens: 20, output_tokens: 10 }, "los tokens de las dos llamadas");
  });

  test("la solución escrita por el código: fracciones, potencias, raíces y coma decimal", () => {
    assert.equal(latexDeTexto("9/11"), "\\frac{9}{11}");
    assert.equal(latexDeTexto("-9/11"), "-\\frac{9}{11}");
    assert.equal(latexDeTexto("3*x^2-2"), "3x^{2}-2");
    assert.equal(latexDeTexto("sqrt(5)"), "\\sqrt{5}");
    assert.equal(latexDeTexto("0.5"), "0{,}5");
    assert.equal(solucionDeApartados([{ tipo: "sistema", apartado: "a", respuesta: { x: "6", y: "4" } }, { tipo: "ecuacion", apartado: "b", respuesta: "sin solución" }]), "a) $x = 6$, $y = 4$; b) sin solución");
    assert.equal(solucionDeApartados([{ tipo: "igualdad", expresion: "2*(x+1)", respuesta: "2*x+2" }]), "$2x+2$");
  });

  test("PENSAR ES LO NORMAL; sin pensar, se obliga a usar la herramienta (para comparar en el banco de pruebas)", async () => {
    const ia = iaQueDevuelve([bueno()]);
    await generaHojaIA({ client: ia, model: "m", etapa: "eso", materia: "matematicas", curso: 2, tema: "ecuaciones-primer-grado", cuantos: 1, pensar: false });
    assert.equal(ia.llamadas[0].thinking, undefined);
    assert.deepEqual(ia.llamadas[0].tool_choice, { type: "tool", name: "escribir_hoja" });
  });

  test("si la IA no usa la herramienta, cero ejercicios, se dice, y la segunda llamada lo intenta", async () => {
    const llamadas = [];
    const ia = { messages: { create: async (p) => { llamadas.push(p); return llamadas.length === 1 ? { content: [{ type: "text", text: "Aquí tienes…" }], usage: {} } : { content: [{ type: "tool_use", name: "escribir_hoja", input: { ejercicios: [bueno()] } }], usage: {} }; } } };
    const r = await generaHojaIA({ client: ia, model: "m", etapa: "eso", materia: "matematicas", curso: 2, tema: "ecuaciones-primer-grado", cuantos: 1 });
    assert.equal(llamadas.length, 2);
    assert.equal(r.hoja.actividades.length, 1);
    assert.match(r.descartes.map((d) => d.motivo).join(), /no usó la herramienta/);
  });

  test("LO QUE EL VERIFICADOR NO VE (2.ª prueba real): la IA corrigiéndose en el enunciado, y el problema de respuesta 0", async () => {
    const cine = { tipo: "problema", subtipo: "planteamiento", dificultad: 2, saber: "D.2",
      enunciado: "Tres amigos van al cine… En realidad, simplifica: el precio rebajado es 6 €. Plantea y resuelve.",
      solucion: "x = 1", comprobar: [{ tipo: "ecuacion", ecuacion: "8*x+6*(3-x) = 20", respuesta: ["1"] }] };
    const cero = { ...cine, enunciado: "Tres amigos pagan 18 € por tres entradas de 8 € o 6 €. ¿Cuántas son de 8 €?", solucion: "x = 0", comprobar: [{ tipo: "ecuacion", ecuacion: "8*x+6*(3-x) = 18", respuesta: ["0"] }] };
    const bien = { ...cine, enunciado: "Tres amigos pagan 20 € por tres entradas de 8 € o 6 €. ¿Cuántas son de 8 €?" };
    const r = await generaHojaIA({ client: iaQueDevuelve([cine, cero, bien]), model: "m", etapa: "eso", materia: "matematicas", curso: 2, tema: "ecuaciones-primer-grado", cuantos: 3 });
    const motivos = r.descartes.map((d) => d.motivo).join(" | ");
    assert.match(motivos, /se corrige dentro del enunciado/);
    assert.match(motivos, /respuesta 0/);
    assert.equal(r.huecos.filter((h) => h.nombre === "planteamiento").length >= 1, true);
    const problema = r.huecos.find((h) => h.nombre === "planteamiento");
    assert.equal(problema.verificacion, "comprobada");
    assert.equal(problema.revisar, "enunciado", "un problema con la cuenta bien sigue necesitando que alguien lea el enunciado");
  });

  test("dos códigos de saber del tema («D.2, D.4», 3.ª prueba real): vale, con el primero; si uno es de fuera, fuera", async () => {
    const r = await generaHojaIA({ client: iaQueDevuelve([bueno({ saber: "D.2, D.4" }), bueno({ saber: "D.4, E.1", dificultad: 1 })]), model: "m", etapa: "eso", materia: "matematicas", curso: 2, tema: "ecuaciones-primer-grado", cuantos: 1 });
    assert.equal(r.huecos.length, 1);
    assert.equal(r.huecos[0].saber.codigo, "D.2");
    assert.match(r.descartes[0].motivo, /D\.4, E\.1 fuera del tema/);
  });

  test("un ejercicio de técnica no lleva «revisar el enunciado»", async () => {
    const r = await generaHojaIA({ client: iaQueDevuelve([bueno()]), model: "m", etapa: "eso", materia: "matematicas", curso: 2, tema: "ecuaciones-primer-grado", cuantos: 1 });
    assert.equal(r.huecos[0].revisar, undefined);
  });

  test("SOLO ENTEROS si el profesor lo pide: se quitan los apartados con fracción y se dice en el mensaje; por defecto, las fracciones valen", async () => {
    const conFraccion = bueno({
      apartados: ["$2x = 6$", "$5x = 2$"],
      comprobar: [
        { tipo: "ecuacion", apartado: "a", ecuacion: "2*x = 6", respuesta: ["3"] },
        { tipo: "ecuacion", apartado: "b", ecuacion: "5*x = 2", respuesta: ["2/5"] },
      ],
    });
    const ia = iaQueDevuelve([conFraccion]);
    const r = await generaHojaIA({ client: ia, model: "m", etapa: "eso", materia: "matematicas", curso: 2, tema: "ecuaciones-primer-grado", cuantos: 1, soloEnteros: true });
    assert.deepEqual(r.hoja.actividades[0].apartados, ["$2x = 6$"]);
    assert.match(r.descartes.map((d) => d.motivo).join(), /no es entero/);
    assert.match(ia.llamadas[0].messages[0].content, /TODAS las soluciones tienen que ser números enteros/);
    const libre = iaQueDevuelve([conFraccion]);
    const r2 = await generaHojaIA({ client: libre, model: "m", etapa: "eso", materia: "matematicas", curso: 2, tema: "ecuaciones-primer-grado", cuantos: 1 });
    assert.equal(r2.hoja.actividades[0].apartados.length, 2, "sin pedirlo, 2/5 se queda");
    assert.doesNotMatch(libre.llamadas[0].messages[0].content, /números enteros/);
  });

  test("un tema sin referencias no se genera", async () => {
    assert.equal(await generaHojaIA({ client: iaQueDevuelve([]), model: "m", etapa: "eso", materia: "matematicas", curso: 2, tema: "no-existe" }), null);
  });

  for (const [metodo, url] of [["GET", "/api/v1/recursos/hojas/ia/temas?etapa=eso&materia=matematicas&curso=2"], ["POST", "/api/v1/recursos/hojas/ia/generar"]]) {
    test(`hojas IA wiring: ${metodo} ${url.split("?")[0]} existe y exige sesión`, async () => {
      const app = await createApp();
      const res = await app.inject({ method: metodo, url, payload: metodo === "POST" ? {} : undefined });
      await app.close();
      assert.ok([400, 401, 403].includes(res.statusCode), `recibió ${res.statusCode}`);
    });
  }

  test("MIGRACIÓN 149: 'hojas_ia' entra en los source de ai_token_usage sin perder los que había", () => {
    const sql = readFileSync(new URL("../supabase/migrations/149_token_usage_hojas_ia.sql", import.meta.url), "utf8");
    for (const s of ["chat", "guide_detect", "guide_steps", "hojas_interpretar", "programacion_unidades", "programacion_textos", "hojas_ia"]) assert.match(sql, new RegExp(`'${s}'`));
  });
}
