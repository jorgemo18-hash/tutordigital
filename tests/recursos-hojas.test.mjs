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
  const { CONCEPTOS_POR_TEMA } = await import("../server/lib/generadorEjercicios/conceptosDelTema.js");
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
  });
}
