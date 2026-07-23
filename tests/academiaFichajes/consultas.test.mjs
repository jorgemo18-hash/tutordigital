import { makeFakeSupabaseAdmin } from "../support/fakeSupabaseAdmin.mjs";

export async function run({ test, assert }) {
  const {
    fetchTrabajadoresDelTenant, fetchFichajesDeTrabajador, fetchEstadoActual,
  } = await import("../../server/lib/academiaFichajes/consultas.js");

  const TENANT_ID = "t1";
  const WORKER_ID = "w1";

  test("fetchTrabajadoresDelTenant solo incluye admin/teacher activos del tenant", async () => {
    const admin = makeFakeSupabaseAdmin({
      tenant_memberships: [
        { user_id: "w1", tenant_id: TENANT_ID, role: "admin", status: "active", profiles: { id: "w1", display_name: "Ana" } },
        { user_id: "w2", tenant_id: TENANT_ID, role: "teacher", status: "active", profiles: { id: "w2", display_name: "Luis" } },
        { user_id: "w3", tenant_id: TENANT_ID, role: "student", status: "active", profiles: { id: "w3", display_name: "Alumno" } },
        { user_id: "w4", tenant_id: TENANT_ID, role: "admin", status: "inactive", profiles: { id: "w4", display_name: "Baja" } },
        { user_id: "w5", tenant_id: "otro", role: "admin", status: "active", profiles: { id: "w5", display_name: "Otro centro" } },
      ],
    });
    const { trabajadores, error } = await fetchTrabajadoresDelTenant(admin, TENANT_ID);
    assert.equal(error, undefined);
    assert.deepEqual(trabajadores.map((t) => t.profileId).sort(), ["w1", "w2"]);
  });

  test("fetchEstadoActual: sin fichajes hoy, está 'fuera'", async () => {
    const admin = makeFakeSupabaseAdmin({ academia_fichajes: [] });
    const { dentro, ultimoTipo } = await fetchEstadoActual(admin, TENANT_ID, WORKER_ID);
    assert.equal(dentro, false);
    assert.equal(ultimoTipo, null);
  });

  test("fetchEstadoActual: última fichaje de hoy es 'entrada' => dentro", async () => {
    const hoy = new Date().toISOString();
    const admin = makeFakeSupabaseAdmin({
      academia_fichajes: [
        { id: "f1", tenant_id: TENANT_ID, worker_profile_id: WORKER_ID, tipo: "entrada", timestamp_servidor: hoy },
      ],
    });
    const { dentro, ultimoTipo } = await fetchEstadoActual(admin, TENANT_ID, WORKER_ID);
    assert.equal(dentro, true);
    assert.equal(ultimoTipo, "entrada");
  });

  test("fetchEstadoActual: una corrección de admin también cuenta para el estado", async () => {
    const hoy = new Date().toISOString();
    const admin = makeFakeSupabaseAdmin({
      academia_fichajes: [
        { id: "f1", tenant_id: TENANT_ID, worker_profile_id: WORKER_ID, tipo: "entrada", origen: "admin_correccion", timestamp_servidor: hoy },
      ],
    });
    const { dentro } = await fetchEstadoActual(admin, TENANT_ID, WORKER_ID);
    assert.equal(dentro, true);
  });

  test("fetchFichajesDeTrabajador devuelve original y corrección como filas separadas, sin fusionar", async () => {
    const admin = makeFakeSupabaseAdmin({
      academia_fichajes: [
        {
          id: "f1", tenant_id: TENANT_ID, worker_profile_id: WORKER_ID, tipo: "entrada",
          origen: "worker", timestamp_servidor: "2026-07-05T08:00:00.000Z",
          fichaje_corregido_id: null, motivo: null, corregido_por: null,
        },
        {
          id: "f2", tenant_id: TENANT_ID, worker_profile_id: WORKER_ID, tipo: "salida",
          origen: "admin_correccion", timestamp_servidor: "2026-07-05T17:00:00.000Z",
          fichaje_corregido_id: null, motivo: "Se le olvidó fichar la salida",
          corregido_por: "admin1", corrector: { display_name: "María Admin" },
        },
      ],
    });
    const { fichajes, error } = await fetchFichajesDeTrabajador(admin, TENANT_ID, WORKER_ID, { mes: 7, anio: 2026 });
    assert.equal(error, undefined);
    assert.equal(fichajes.length, 2, "original y corrección deben venir como dos filas, no una fusionada");
    const correccion = fichajes.find((f) => f.origen === "admin_correccion");
    assert.equal(correccion.motivo, "Se le olvidó fichar la salida");
    assert.equal(correccion.corregidoPorNombre, "María Admin");
    const original = fichajes.find((f) => f.origen === "worker");
    assert.equal(original.motivo, null);
  });

  test("fetchFichajesDeTrabajador filtra fuera del rango del mes pedido", async () => {
    const admin = makeFakeSupabaseAdmin({
      academia_fichajes: [
        { id: "f1", tenant_id: TENANT_ID, worker_profile_id: WORKER_ID, tipo: "entrada", origen: "worker", timestamp_servidor: "2026-06-30T23:59:00.000Z" },
        { id: "f2", tenant_id: TENANT_ID, worker_profile_id: WORKER_ID, tipo: "entrada", origen: "worker", timestamp_servidor: "2026-07-01T00:00:00.000Z" },
      ],
    });
    const { fichajes } = await fetchFichajesDeTrabajador(admin, TENANT_ID, WORKER_ID, { mes: 7, anio: 2026 });
    assert.equal(fichajes.length, 1);
    assert.equal(fichajes[0].id, "f2");
  });
}
