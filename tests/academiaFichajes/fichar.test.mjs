import { makeFakeSupabaseAdmin } from "../support/fakeSupabaseAdmin.mjs";

// registrarFichaje nunca debe aceptar un timestamp del cliente: aunque el
// caller (por error o de forma maliciosa) pase timestamp_servidor en el
// objeto de entrada, la función no lo reenvía al INSERT — el fake de
// Supabase simula el default de la columna real (now()) siempre que la
// fila insertada no traiga ya un timestamp_servidor.
export async function run({ test, assert }) {
  const { registrarFichaje } = await import("../../server/lib/academiaFichajes/fichar.js");

  const TENANT_ID = "t1";
  const WORKER_ID = "w1";

  test("registra un fichaje de entrada con origen 'worker'", async () => {
    const admin = makeFakeSupabaseAdmin({});
    const resultado = await registrarFichaje(admin, { tenantId: TENANT_ID, workerProfileId: WORKER_ID, tipo: "entrada" });
    assert.equal(resultado.ok, true);
    assert.equal(resultado.fichaje.tipo, "entrada");

    const filas = admin._state.tables.academia_fichajes;
    assert.equal(filas.length, 1);
    assert.equal(filas[0].origen, "worker");
    assert.equal(filas[0].worker_profile_id, WORKER_ID);
  });

  test("nunca envía timestamp_servidor en el INSERT aunque el caller intente colarlo", async () => {
    const admin = makeFakeSupabaseAdmin({});
    // Un caller malicioso o con un bug podría intentar pasar un
    // timestamp_servidor propio en el objeto de entrada — registrarFichaje
    // no lo lee ni lo reenvía en absoluto (ver fichar.js: solo desestructura
    // tenantId/workerProfileId/tipo del segundo argumento).
    await registrarFichaje(admin, {
      tenantId: TENANT_ID, workerProfileId: WORKER_ID, tipo: "entrada",
      timestamp_servidor: "2000-01-01T00:00:00.000Z",
    });
    const fila = admin._state.tables.academia_fichajes[0];
    assert.notEqual(fila.timestamp_servidor, "2000-01-01T00:00:00.000Z");
  });

  test("rechaza un tipo inválido sin llegar a insertar nada", async () => {
    const admin = makeFakeSupabaseAdmin({});
    const resultado = await registrarFichaje(admin, { tenantId: TENANT_ID, workerProfileId: WORKER_ID, tipo: "otra-cosa" });
    assert.equal(resultado.ok, false);
    assert.equal(resultado.code, "tipo_invalido");
    assert.equal((admin._state.tables.academia_fichajes || []).length, 0);
  });
}
