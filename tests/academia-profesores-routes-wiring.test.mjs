import assert from "node:assert/strict";

// Mismo patrón que academiaFichajes/routesWiring.test.mjs: sin
// credenciales reales, solo comprueba que las rutas existen y están
// protegidas (nunca 404, siempre exigen sesión).
export async function run({ test }) {
  const { createApp } = await import("../server/app.js");

  const RUTAS_PROTEGIDAS = [
    { method: "GET", url: "/api/v1/academia/profesores/alumnos-disponibles" },
    { method: "GET", url: "/api/v1/academia/profesores/profesor-1/alumnos" },
    { method: "POST", url: "/api/v1/academia/profesores/profesor-1/alumnos" },
    { method: "DELETE", url: "/api/v1/academia/profesores/profesor-1/alumnos/alumno-1" },
  ];

  for (const ruta of RUTAS_PROTEGIDAS) {
    test(`academia profesores wiring: ${ruta.method} ${ruta.url} existe y exige sesión`, async () => {
      const app = await createApp();
      const res = await app.inject({ method: ruta.method, url: ruta.url });
      await app.close();

      assert.notEqual(res.statusCode, 404);
      assert.ok([400, 401, 403].includes(res.statusCode), `esperaba 4xx de auth/tenant, recibió ${res.statusCode}`);
    });
  }
}
