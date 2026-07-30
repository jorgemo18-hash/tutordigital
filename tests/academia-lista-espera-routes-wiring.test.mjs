import assert from "node:assert/strict";

// Mismo patrón que academia-sustituciones-routes-wiring.test.mjs: sin
// credenciales reales, solo comprueba que las rutas existen y están
// protegidas. El control de acceso fino se cubre a nivel de unidad en
// tests/academiaListaEspera/.
export async function run({ test }) {
  const { createApp } = await import("../server/app.js");

  const RUTAS_PROTEGIDAS = [
    { method: "GET", url: "/api/v1/academia/lista-espera" },
    { method: "POST", url: "/api/v1/academia/lista-espera" },
    { method: "DELETE", url: "/api/v1/academia/lista-espera/entrada-1" },
  ];

  for (const ruta of RUTAS_PROTEGIDAS) {
    test(`lista-espera wiring: ${ruta.method} ${ruta.url} existe y exige sesión`, async () => {
      const app = await createApp();
      const res = await app.inject({ method: ruta.method, url: ruta.url });
      await app.close();

      assert.notEqual(res.statusCode, 404);
      assert.ok([400, 401, 403].includes(res.statusCode), `esperaba 4xx de auth/tenant, recibió ${res.statusCode}`);
    });
  }

  // REGRESIÓN — admin-only en los 3 endpoints, "teacher" nunca en esos
  // roles (aunque la política RLS de la tabla sí lo permita) — mismo
  // criterio que el test equivalente de sustituciones.
  test("lista-espera: listar/crear/eliminar son admin-only, 'teacher' nunca está en esos roles", async () => {
    const { ROLES_LISTAR, ROLES_CREAR, ROLES_ELIMINAR } = await import(
      "../server/routes/v1/academia-lista-espera/lista-espera.routes.js"
    );
    assert.deepEqual(ROLES_LISTAR, ["admin"]);
    assert.deepEqual(ROLES_CREAR, ["admin"]);
    assert.deepEqual(ROLES_ELIMINAR, ["admin"]);
  });
}
