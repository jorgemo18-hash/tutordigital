import assert from "node:assert/strict";
import fs from "node:fs";

const RAIZ = new URL("../", import.meta.url).pathname;

// EL GENERADOR DE HOJAS EN RECURSOS DEL PROFESOR DE INSTITUTO. Las rutas son
// las mismas que las de la academia (hojas/rutasDeHojas.js); aquí se
// comprueba que existen con su prefijo, quién entra, y lo que la pantalla
// del diseño enseña de cada ejercicio.
export async function run({ test }) {
  const { createApp } = await import("../server/app.js");
  const { ROLES } = await import("../server/routes/v1/recursos.hojas.routes.js");
  const academia = await import("../server/routes/v1/academia.hojas-ejercicios.routes.js");
  const { hojaDelPanel, actividadDelPanel, catalogoDelPanel } = await import("../server/lib/generadorEjercicios/hojaDelPanel.js");
  const { NOMBRE_DEL_SABER } = await import("../server/lib/generadorEjercicios/saberesBasicos.js");
  const { todasLasBaterias, objetivosDe } = await import("../server/lib/generadorEjercicios/catalogoDeBaterias.js");
  const { TEMAS_CON_GENERADOR } = await import("../server/lib/generadorEjercicios/temasConGenerador.js");
  const TEMA = TEMAS_CON_GENERADOR[0].id;

  for (const ruta of [
    { method: "GET", url: "/api/v1/recursos/hojas/catalogo" },
    { method: "POST", url: "/api/v1/recursos/hojas/generar" },
    { method: "POST", url: "/api/v1/recursos/hojas/actividad" },
    { method: "POST", url: "/api/v1/recursos/hojas/interpretar" },
  ]) {
    test(`recursos/hojas wiring: ${ruta.method} ${ruta.url} existe y exige sesión`, async () => {
      const app = await createApp();
      const res = await app.inject({ method: ruta.method, url: ruta.url });
      await app.close();
      assert.notEqual(res.statusCode, 404);
      assert.ok([400, 401, 403].includes(res.statusCode), `esperaba 4xx de auth/tenant, recibió ${res.statusCode}`);
    });
  }

  test("recursos/hojas: entran el profesor y el admin; la academia sigue siendo solo admin", () => {
    assert.deepEqual(ROLES, ["teacher", "admin"]);
    assert.deepEqual(academia.ROLES, ["admin"]);
  });

  // Que los nombres y saberes de los conceptos sean los de la base de datos
  // lo comprueba catalogoDeBaterias.test.mjs, tema a tema.
  test("cada saber de cada tema tiene nombre (lo enseña la pantalla)", () => {
    for (const tema of TEMAS_CON_GENERADOR) {
      for (const codigo of new Set(Object.values(tema.saberes))) {
        assert.ok(NOMBRE_DEL_SABER[codigo], `${tema.nombre}: sin nombre para el saber ${codigo}`);
      }
    }
  });

  test("TODA BATERÍA tiene el nombre de su concepto (ninguna fila sin concepto en la pantalla)", () => {
    for (const tema of TEMAS_CON_GENERADOR) {
      for (const b of todasLasBaterias(tema)) assert.ok(tema.conceptos[b.concepto], `${b.clave} sin concepto`);
    }
  });

  test("CADA HUECO lleva nombre, dificultad y concepto, también el de un ejercicio cambiado", () => {
    const { huecos } = hojaDelPanel({ temaId: TEMA, objetivo: 4, intensidad: "refuerzo", semilla: "x" });
    assert.ok(huecos.length >= 1);
    for (const h of huecos) {
      assert.equal(typeof h.nombre, "string");
      assert.ok([1, 2, 3].includes(h.dificultad));
      assert.equal(typeof h.concepto, "string");
    }
    const repaso = huecos.find((h) => h.esRepaso);
    if (repaso) assert.ok(repaso.objetivo < 4);
    const { hueco } = actividadDelPanel({ temaId: TEMA, objetivo: 3, intensidad: "normal", clave: "suma_mismo_signo", semilla: "y" });
    assert.equal(hueco.concepto, "Suma de enteros del mismo y de distinto signo");
    assert.equal(hueco.dificultad, 1);
    assert.deepEqual(hueco.saber, {
      codigo: "A.3", nombre: "Sentido de las operaciones", implicito: false, referencia: "ORDEN ECD/1172/2022 (Aragón)",
      vineta: "Operaciones con números enteros, fraccionarios o decimales en situaciones contextualizadas.",
    });
  });

  test("TODO EL TEMA: un ejercicio de cada objetivo, en orden, de dificultad 1 o 2, ninguno 'de repaso'", async () => {
    const OBJETIVOS = objetivosDe(TEMAS_CON_GENERADOR[0]);
    for (const semilla of ["a", "b", "c", "d"]) {
      const { hoja, huecos } = hojaDelPanel({ temaId: TEMA, objetivo: 2, intensidad: "normal", semilla, todoElTema: true, actividades: 2 });
      assert.deepEqual(huecos.map((h) => h.objetivo), OBJETIVOS, "uno por objetivo, en orden (y 'actividades' no cuenta)");
      assert.ok(huecos.every((h) => h.dificultad <= 2 && h.esRepaso === false));
      assert.equal(hoja.objetivo, "Repaso de todo el tema");
    }
    const { GenerarSchema } = await import("../server/routes/v1/hojas/rutasDeHojas.js");
    assert.equal(GenerarSchema.safeParse({ temaId: TEMA, objetivo: 1, intensidad: "normal", todoElTema: true }).success, true);
  });

  test("EL CATÁLOGO lleva el código del saber de cada tipo (para 'Elegir del catálogo')", () => {
    const o1 = catalogoDelPanel().temas[0].objetivos[0];
    assert.equal(o1.baterias.find((b) => b.clave === "series_numericas").saber, "A.4");
    assert.equal(o1.baterias.find((b) => b.clave === "compara_enteros").saber, "A.2");
  });

  test("UN TIPO CON SABER PROPIO lo dice (series → A.4 patrones; término que falta → A.3 relaciones inversas)", () => {
    const serie = actividadDelPanel({ temaId: TEMA, objetivo: 1, intensidad: "normal", clave: "series_numericas", semilla: "s" });
    assert.equal(serie.hueco.saber.codigo, "A.4");
    assert.equal(serie.hueco.saber.vineta, "Patrones y regularidades numéricas.");
    const falta = actividadDelPanel({ temaId: TEMA, objetivo: 3, intensidad: "normal", clave: "termino_que_falta", semilla: "s" });
    assert.ok(falta.hueco.saber.vineta.startsWith("Relaciones inversas entre las operaciones"));
  });
}
