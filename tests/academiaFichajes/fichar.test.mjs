import { makeFakeSupabaseAdmin } from "../support/fakeSupabaseAdmin.mjs";

// El fake compartido no simula un INSERT que falle con un error concreto de
// Postgres/PostgREST (no hay validación de constraints) — wrapper local
// mínimo, mismo criterio que siguienteNumeroRecibo.test.mjs, que fuerza el
// error solo para la tabla indicada y deja el resto del fake intacto (aquí
// hace falta: registrarFichaje llama primero a ensureProfileExists, que sí
// necesita el comportamiento normal del fake sobre "profiles").
function conInsertQueFalla(admin, tabla, errorSimulado) {
  return {
    from(table) {
      if (table !== tabla) return admin.from(table);
      return {
        insert: () => ({
          select: () => ({
            single: () => Promise.resolve({ data: null, error: errorSimulado }),
          }),
        }),
      };
    },
    _state: admin._state,
  };
}

// registrarFichaje nunca debe aceptar un timestamp del cliente: aunque el
// caller (por error o de forma maliciosa) pase timestamp_servidor en el
// objeto de entrada, la función no lo reenvía al INSERT — el fake de
// Supabase simula el default de la columna real (now()) siempre que la
// fila insertada no traiga ya un timestamp_servidor.
export async function run({ test, assert }) {
  const { registrarFichaje } = await import("../../server/lib/academiaFichajes/fichar.js");

  const TENANT_ID = "t1";
  const TENANT_SLUG = "academia-demo";
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

  // Regresión del bug real en producción: un profesor invitado por el
  // flujo antiguo (sin el fix de profileProvisioning.js) nunca tenía fila
  // en profiles, y academia_fichajes.worker_profile_id exige una (ver
  // migración 093) — el INSERT reventaba con una violación de FK. Aquí se
  // simula exactamente ese estado (worker sin fila previa en profiles) y
  // se comprueba que registrarFichaje se autocura antes de intentar el
  // INSERT, en vez de depender de un backfill manual en producción.
  test("un trabajador SIN fila previa en profiles puede fichar igual (autocura la fila que falta)", async () => {
    const admin = makeFakeSupabaseAdmin({ profiles: [] });
    const resultado = await registrarFichaje(admin, { tenantId: TENANT_ID, tenantSlug: TENANT_SLUG, workerProfileId: WORKER_ID, tipo: "entrada" });
    assert.equal(resultado.ok, true, resultado.motivo);
    const perfil = admin._state.tables.profiles.find((p) => p.id === WORKER_ID);
    assert.ok(perfil, "debe haber creado la fila de profiles que faltaba");
  });

  // REGRESIÓN — causa raíz real de producción: la fila de profiles que se
  // autocura aquí no debe quedar con display_name NULL si el trabajador ya
  // tenía nombre en teacher_profiles (ver profileProvisioning.js). Antes de
  // este fix, este es exactamente el camino que dejaba "Declarada por"/
  // "Revocada por" vacío en sustituciones para profesores.
  test("al autocurar la fila de profiles, resuelve el nombre real desde teacher_profiles del tenant", async () => {
    const admin = makeFakeSupabaseAdmin({
      profiles: [],
      teacher_profiles: [{ id: "tp-1", user_id: WORKER_ID, tenant_slug: TENANT_SLUG, display_name: "Profe Sin Redeem" }],
    });
    const resultado = await registrarFichaje(admin, { tenantId: TENANT_ID, tenantSlug: TENANT_SLUG, workerProfileId: WORKER_ID, tipo: "entrada" });
    assert.equal(resultado.ok, true, resultado.motivo);
    const perfil = admin._state.tables.profiles.find((p) => p.id === WORKER_ID);
    assert.equal(perfil.display_name, "Profe Sin Redeem");
  });

  // El bug histórico de findProfesorId() era exactamente esto: descartar el
  // error real de Supabase y sustituirlo por un texto genérico, dejando los
  // logs de producción sin ninguna pista real. registrarFichaje debe
  // conservar el error original para que la ruta lo pueda loguear tal cual.
  test("si el INSERT falla, el resultado conserva el error real de Supabase (no solo el texto genérico)", async () => {
    const errorReal = { code: "23503", message: 'insert or update on table "academia_fichajes" violates foreign key constraint', hint: null, details: "Key (worker_profile_id)=(w1) is not present in table \"profiles\"." };
    const admin = conInsertQueFalla(makeFakeSupabaseAdmin({}), "academia_fichajes", errorReal);
    const resultado = await registrarFichaje(admin, { tenantId: TENANT_ID, workerProfileId: WORKER_ID, tipo: "entrada" });
    assert.equal(resultado.ok, false);
    assert.equal(resultado.code, "fichaje_failed");
    assert.deepEqual(resultado.error, errorReal, "el error real de Postgres debe viajar en el resultado, no perderse");
  });
}
