import { makeFakeSupabaseAdmin } from "../support/fakeSupabaseAdmin.mjs";

export async function run({ test, assert }) {
  const { registrarCorreccion } = await import("../../server/lib/academiaFichajes/correccion.js");

  const TENANT_ID = "t1";
  const OTRO_TENANT_ID = "t2";
  const WORKER_ID = "w1";
  const OTRO_WORKER_ID = "w2";
  const ADMIN_ID = "admin1";

  test("rechaza una corrección sin motivo", async () => {
    const admin = makeFakeSupabaseAdmin({});
    const resultado = await registrarCorreccion(admin, {
      tenantId: TENANT_ID, workerProfileId: WORKER_ID, tipo: "entrada", motivo: "", corregidoPor: ADMIN_ID,
    });
    assert.equal(resultado.ok, false);
    assert.equal(resultado.code, "motivo_requerido");
    assert.equal((admin._state.tables.academia_fichajes || []).length, 0);
  });

  test("rechaza una corrección con motivo en blanco (solo espacios)", async () => {
    const admin = makeFakeSupabaseAdmin({});
    const resultado = await registrarCorreccion(admin, {
      tenantId: TENANT_ID, workerProfileId: WORKER_ID, tipo: "entrada", motivo: "   ", corregidoPor: ADMIN_ID,
    });
    assert.equal(resultado.ok, false);
    assert.equal(resultado.code, "motivo_requerido");
  });

  test("una corrección standalone (sin fichaje corregido) se inserta con origen admin_correccion", async () => {
    const admin = makeFakeSupabaseAdmin({});
    const resultado = await registrarCorreccion(admin, {
      tenantId: TENANT_ID, workerProfileId: WORKER_ID, tipo: "entrada",
      motivo: "Se le olvidó fichar", corregidoPor: ADMIN_ID,
    });
    assert.equal(resultado.ok, true, resultado.motivo);
    const fila = admin._state.tables.academia_fichajes[0];
    assert.equal(fila.origen, "admin_correccion");
    assert.equal(fila.motivo, "Se le olvidó fichar");
    assert.equal(fila.corregido_por, ADMIN_ID);
    assert.equal(fila.fichaje_corregido_id, null);
  });

  test("rechaza corregir un fichaje que no existe en este tenant", async () => {
    const admin = makeFakeSupabaseAdmin({
      academia_fichajes: [{ id: "f1", tenant_id: OTRO_TENANT_ID, worker_profile_id: WORKER_ID, tipo: "entrada", origen: "worker" }],
    });
    const resultado = await registrarCorreccion(admin, {
      tenantId: TENANT_ID, workerProfileId: WORKER_ID, tipo: "salida",
      fichajeCorregidoId: "f1", motivo: "motivo", corregidoPor: ADMIN_ID,
    });
    assert.equal(resultado.ok, false);
    assert.equal(resultado.code, "not_found");
  });

  test("rechaza corregir un fichaje que pertenece a otro trabajador", async () => {
    const admin = makeFakeSupabaseAdmin({
      academia_fichajes: [{ id: "f1", tenant_id: TENANT_ID, worker_profile_id: OTRO_WORKER_ID, tipo: "entrada", origen: "worker" }],
    });
    const resultado = await registrarCorreccion(admin, {
      tenantId: TENANT_ID, workerProfileId: WORKER_ID, tipo: "salida",
      fichajeCorregidoId: "f1", motivo: "motivo", corregidoPor: ADMIN_ID,
    });
    assert.equal(resultado.ok, false);
    assert.equal(resultado.code, "fichaje_de_otro_trabajador");
  });

  test("corrección enlazada a un fichaje existente del mismo trabajador tiene éxito", async () => {
    const admin = makeFakeSupabaseAdmin({
      academia_fichajes: [{ id: "f1", tenant_id: TENANT_ID, worker_profile_id: WORKER_ID, tipo: "entrada", origen: "worker" }],
    });
    const resultado = await registrarCorreccion(admin, {
      tenantId: TENANT_ID, workerProfileId: WORKER_ID, tipo: "entrada",
      fichajeCorregidoId: "f1", motivo: "Hora real distinta", corregidoPor: ADMIN_ID,
    });
    assert.equal(resultado.ok, true, resultado.motivo);
    const nueva = admin._state.tables.academia_fichajes.find((f) => f.id !== "f1");
    assert.equal(nueva.fichaje_corregido_id, "f1");
    // El fichaje original nunca se toca (append-only): sigue con su
    // origen/tipo intactos, la corrección es una fila aparte.
    const original = admin._state.tables.academia_fichajes.find((f) => f.id === "f1");
    assert.equal(original.origen, "worker");
  });
}
