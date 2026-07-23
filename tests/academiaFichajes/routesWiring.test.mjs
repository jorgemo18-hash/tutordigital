import assert from "node:assert/strict";

// Mismo patrón que admin-teachers-routes-wiring.test.mjs: sin credenciales
// reales, solo comprueba que las rutas existen y están protegidas (nunca
// 404, nunca accesibles sin sesión). El control de acceso fino
// (admin-only vs admin+teacher) se cubre a nivel de unidad en
// fichar.test.mjs/correccion.test.mjs vía las funciones de lib.
export async function run({ test }) {
  const { createApp } = await import("../../server/app.js");

  const RUTAS_PROTEGIDAS = [
    { method: "POST", url: "/api/v1/academia/fichajes/fichar" },
    { method: "GET", url: "/api/v1/academia/fichajes/mi-estado" },
    { method: "GET", url: "/api/v1/academia/fichajes/trabajadores" },
    { method: "GET", url: "/api/v1/academia/fichajes/" },
    { method: "POST", url: "/api/v1/academia/fichajes/correccion" },
    { method: "GET", url: "/api/v1/academia/fichajes/exportar" },
  ];

  for (const ruta of RUTAS_PROTEGIDAS) {
    test(`fichajes wiring: ${ruta.method} ${ruta.url} existe y exige sesión`, async () => {
      const app = await createApp();
      const res = await app.inject({ method: ruta.method, url: ruta.url });
      await app.close();

      assert.notEqual(res.statusCode, 404);
      assert.ok([400, 401, 403].includes(res.statusCode), `esperaba 4xx de auth/tenant, recibió ${res.statusCode}`);
    });
  }
}
