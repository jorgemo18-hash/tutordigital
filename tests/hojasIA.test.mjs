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
      bueno({ solucion: "$x = 8$" }), // la solución escrita no dice 7
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
    assert.equal(p.tool_choice.name, "escribir_hoja");
    assert.match(p.messages[0].content, /D\.4 Igualdad y desigualdad: .*Estrategias de búsqueda de soluciones en ecuaciones/);
    assert.match(p.messages[0].content, /EJERCICIOS DE REFERENCIA/);
    assert.match(p.messages[0].content, new RegExp(`ESCRIBE ${3 + DE_MAS} ejercicios`));
    assert.match(p.system, /Matemáticas de 2\.º ESO/);
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
