import assert from "node:assert/strict";

// EL GENERADOR DE HOJAS EN EL PANEL DE LA ACADEMIA: la ruta y lo que monta.
// Mismo patrón de "wiring" que academia-lista-espera-routes-wiring.test.mjs:
// sin credenciales, se comprueba que las rutas existen y exigen sesión.
export async function run({ test }) {
  const { createApp } = await import("../server/app.js");
  const { ROLES, GenerarSchema } = await import("../server/routes/v1/academia.hojas-ejercicios.routes.js");
  const { hojaDelPanel, catalogoDelPanel } = await import("../server/lib/generadorEjercicios/hojaDelPanel.js");

  for (const ruta of [
    { method: "GET", url: "/api/v1/academia/hojas-ejercicios/catalogo" },
    { method: "POST", url: "/api/v1/academia/hojas-ejercicios/generar" },
  ]) {
    test(`hojas-ejercicios wiring: ${ruta.method} ${ruta.url} existe y exige sesión`, async () => {
      const app = await createApp();
      const res = await app.inject({ method: ruta.method, url: ruta.url });
      await app.close();
      assert.notEqual(res.statusCode, 404);
      assert.ok([400, 401, 403].includes(res.statusCode), `esperaba 4xx de auth/tenant, recibió ${res.statusCode}`);
    });
  }

  test("hojas-ejercicios: solo el admin del centro (el panel de academia es de admin)", () => {
    assert.deepEqual(ROLES, ["admin"]);
  });

  test("la petición solo admite objetivos e intensidades que existen", () => {
    assert.equal(GenerarSchema.safeParse({ objetivo: 1, intensidad: "normal" }).success, true);
    assert.equal(GenerarSchema.safeParse({ objetivo: 7, intensidad: "normal" }).success, false);
    assert.equal(GenerarSchema.safeParse({ objetivo: 1, intensidad: "extrema" }).success, false);
    assert.equal(GenerarSchema.safeParse({ objetivo: "1", intensidad: "normal" }).success, false);
    assert.equal(GenerarSchema.safeParse({ objetivo: 1, intensidad: "normal", semilla: "x".repeat(41) }).success, false);
  });

  test("el catálogo ofrece los seis objetivos con su título y las tres intensidades", () => {
    const c = catalogoDelPanel();
    assert.deepEqual(c.objetivos.map((o) => o.numero), [1, 2, 3, 4, 5, 6]);
    assert.ok(c.objetivos.every((o) => o.titulo));
    assert.deepEqual(c.intensidades, ["repaso", "normal", "refuerzo"]);
  });

  test("LA MISMA SEMILLA DA LA MISMA HOJA; otra semilla, otros números", () => {
    const a = hojaDelPanel({ objetivo: 3, intensidad: "normal", semilla: "abc" });
    const b = hojaDelPanel({ objetivo: 3, intensidad: "normal", semilla: "abc" });
    const c = hojaDelPanel({ objetivo: 3, intensidad: "normal", semilla: "otra" });
    assert.deepEqual(a, b);
    assert.notDeepEqual(a.actividades, c.actividades);
  });

  test("la cabecera dice materia, curso y el título del objetivo", () => {
    const hoja = hojaDelPanel({ objetivo: 2, intensidad: "repaso", semilla: "s" });
    assert.equal(hoja.materia, "Matemáticas");
    assert.equal(hoja.curso, "1.º ESO");
    assert.equal(hoja.objetivo, "Valor absoluto y opuesto");
    assert.ok(hoja.actividades.length > 0);
  });
}
