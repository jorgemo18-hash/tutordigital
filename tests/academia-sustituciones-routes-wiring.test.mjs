import assert from "node:assert/strict";

// Mismo patrón que academia-profesores-routes-wiring.test.mjs: sin
// credenciales reales, solo comprueba que las rutas existen y están
// protegidas. El control de acceso fino (reglas de negocio de quién
// puede crear/revocar qué) se cubre a nivel de unidad en
// tests/academiaSustituciones/.
export async function run({ test }) {
  const { createApp } = await import("../server/app.js");

  const RUTAS_PROTEGIDAS = [
    { method: "GET", url: "/api/v1/academia/sustituciones/profesores" },
    { method: "GET", url: "/api/v1/academia/sustituciones" },
    { method: "POST", url: "/api/v1/academia/sustituciones" },
    { method: "POST", url: "/api/v1/academia/sustituciones/sustitucion-1/revocar" },
  ];

  for (const ruta of RUTAS_PROTEGIDAS) {
    test(`sustituciones wiring: ${ruta.method} ${ruta.url} existe y exige sesión`, async () => {
      const app = await createApp();
      const res = await app.inject({ method: ruta.method, url: ruta.url });
      await app.close();

      assert.notEqual(res.statusCode, 404);
      assert.ok([400, 401, 403].includes(res.statusCode), `esperaba 4xx de auth/tenant, recibió ${res.statusCode}`);
    });
  }

  // REGRESIÓN — gestión (crear/revocar) exclusiva del admin: sin sesión
  // real no se puede probar un 403 de rol específico vía HTTP (siempre
  // gana el 401 de "no autenticado" antes de llegar a mirar el rol), así
  // que se fija la propia decisión de seguridad — los arrays de roles
  // que la ruta pasa a requireRole() — en vez de un valor literal que
  // alguien podría cambiar sin que nada lo note. Si "teacher" volviera a
  // colarse aquí, este test lo detecta sin necesitar una sesión de
  // profesor de verdad.
  test("sustituciones: crear y revocar son admin-only, 'teacher' nunca está en esos roles", async () => {
    const { ROLES_CREAR, ROLES_REVOCAR } = await import("../server/routes/v1/academia-sustituciones/sustituciones.routes.js");
    assert.deepEqual(ROLES_CREAR, ["admin"]);
    assert.deepEqual(ROLES_REVOCAR, ["admin"]);
  });
}
