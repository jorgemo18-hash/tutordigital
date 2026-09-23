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
  const { hojaDelPanel, actividadDelPanel } = await import("../server/lib/generadorEjercicios/hojaDelPanel.js");
  const { CONCEPTOS_POR_TEMA, SABER_POR_CONCEPTO } = await import("../server/lib/generadorEjercicios/conceptosDelTema.js");
  const { NOMBRE_DEL_SABER } = await import("../server/lib/generadorEjercicios/saberesBasicos.js");
  const { BATERIAS_POR_OBJETIVO } = await import("../server/lib/generadorEjercicios/catalogoDeBaterias.js");
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

  test("LOS NOMBRES DE LOS CONCEPTOS son literalmente los de la migración 120", () => {
    const sql = fs.readFileSync(`${RAIZ}supabase/migrations/120_semilla_enteros_1eso.sql`, "utf8");
    for (const [temaId, conceptos] of Object.entries(CONCEPTOS_POR_TEMA)) {
      for (const [numero, nombre] of Object.entries(conceptos)) {
        const id = `c1000000-0000-4000-8000-${String(numero).padStart(12, "0")}`;
        assert.ok(
          sql.includes(`('${id}', null, '${temaId}',\n   '${nombre}'`),
          `el concepto ${numero} no se llama "${nombre}" en la migración 120`,
        );
      }
    }
  });

  test("EL SABER BÁSICO de cada concepto es el de la columna `saber` de la migración 120", () => {
    const sql = fs.readFileSync(`${RAIZ}supabase/migrations/120_semilla_enteros_1eso.sql`, "utf8");
    for (const [temaId, saberes] of Object.entries(SABER_POR_CONCEPTO)) {
      for (const [numero, saber] of Object.entries(saberes)) {
        const id = `c1000000-0000-4000-8000-${String(numero).padStart(12, "0")}`;
        const desde = sql.indexOf(`('${id}', null, '${temaId}',`);
        assert.ok(desde >= 0, `falta el concepto ${numero}`);
        const fila = sql.slice(desde, sql.indexOf("\n  (", desde + 1) > 0 ? sql.indexOf("\n  (", desde + 1) : undefined);
        assert.match(fila, new RegExp(`'${saber.replace(".", "\\.")}', (true|false), ${numero}\\)`), `el concepto ${numero} no es del saber ${saber}`);
      }
    }
    for (const codigo of new Set(Object.values(SABER_POR_CONCEPTO).flatMap((x) => Object.values(x)))) {
      assert.ok(NOMBRE_DEL_SABER[codigo], `sin nombre para el saber ${codigo}`);
    }
  });

  test("TODA BATERÍA tiene el nombre de su concepto (ninguna fila sin concepto en la pantalla)", () => {
    for (const lista of Object.values(BATERIAS_POR_OBJETIVO)) {
      for (const b of lista) assert.ok(CONCEPTOS_POR_TEMA[TEMA][b.concepto], `${b.clave} sin concepto`);
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
    const { OBJETIVOS } = await import("../server/lib/generadorEjercicios/catalogoDeBaterias.js");
    for (const semilla of ["a", "b", "c", "d"]) {
      const { hoja, huecos } = hojaDelPanel({ temaId: TEMA, objetivo: 2, intensidad: "normal", semilla, todoElTema: true, actividades: 2 });
      assert.deepEqual(huecos.map((h) => h.objetivo), OBJETIVOS, "uno por objetivo, en orden (y 'actividades' no cuenta)");
      assert.ok(huecos.every((h) => h.dificultad <= 2 && h.esRepaso === false));
      assert.equal(hoja.objetivo, "Repaso de todo el tema");
    }
    const { GenerarSchema } = await import("../server/routes/v1/hojas/rutasDeHojas.js");
    assert.equal(GenerarSchema.safeParse({ temaId: TEMA, objetivo: 1, intensidad: "normal", todoElTema: true }).success, true);
  });

  test("UN TIPO CON SABER PROPIO lo dice (series → A.4 patrones; término que falta → A.3 relaciones inversas)", () => {
    const serie = actividadDelPanel({ temaId: TEMA, objetivo: 1, intensidad: "normal", clave: "series_numericas", semilla: "s" });
    assert.equal(serie.hueco.saber.codigo, "A.4");
    assert.equal(serie.hueco.saber.vineta, "Patrones y regularidades numéricas.");
    const falta = actividadDelPanel({ temaId: TEMA, objetivo: 3, intensidad: "normal", clave: "termino_que_falta", semilla: "s" });
    assert.ok(falta.hueco.saber.vineta.startsWith("Relaciones inversas entre las operaciones"));
  });
}
