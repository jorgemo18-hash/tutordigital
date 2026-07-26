import { makeFakeSupabaseAdmin } from "../support/fakeSupabaseAdmin.mjs";

// El fake compartido no simula un INSERT que falle con un error concreto —
// mismo wrapper local que academiaFichajes/fichar.test.mjs (ver ese archivo
// para el porqué: hace falta dejar intacto el comportamiento normal del
// fake sobre "profiles", que ensureProfileExists sí necesita).
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

export async function run({ test, assert }) {
  const { registrarCorreccion } = await import("../../server/lib/academiaFichajes/correccion.js");

  const TENANT_ID = "t1";
  const TENANT_SLUG = "academia-demo";
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

  // Misma regresión que en fichar.test.mjs: aquí hay DOS columnas que
  // referencian profiles(id) (worker_profile_id y corregido_por, ver
  // migración 093) — ambas deben autocurarse, no solo una.
  // Verificación explícita pedida: "me equivoqué al escribir el motivo de
  // una corrección anterior" debe poder resolverse encadenando OTRA
  // corrección sobre la primera (fichaje_corregido_id apunta a la
  // corrección, no al fichaje original) — nunca editando la existente.
  test("una corrección puede encadenarse sobre OTRA corrección ya existente, no solo sobre el fichaje original", async () => {
    const admin = makeFakeSupabaseAdmin({
      academia_fichajes: [
        { id: "f1", tenant_id: TENANT_ID, worker_profile_id: WORKER_ID, tipo: "entrada", origen: "worker" },
        {
          id: "f2", tenant_id: TENANT_ID, worker_profile_id: WORKER_ID, tipo: "entrada",
          origen: "admin_correccion", fichaje_corregido_id: "f1", motivo: "Se le olvidó fichar",
          corregido_por: ADMIN_ID,
        },
      ],
    });
    const resultado = await registrarCorreccion(admin, {
      tenantId: TENANT_ID, workerProfileId: WORKER_ID, tipo: "entrada",
      fichajeCorregidoId: "f2", motivo: "El motivo anterior tenía un error de escritura", corregidoPor: ADMIN_ID,
    });
    assert.equal(resultado.ok, true, resultado.motivo);

    const nueva = admin._state.tables.academia_fichajes.find((f) => f.id !== "f1" && f.id !== "f2");
    assert.ok(nueva, "debe crear una TERCERA fila, nunca editar f1 ni f2");
    assert.equal(nueva.fichaje_corregido_id, "f2", "encadenada sobre la corrección, no sobre el original");
    assert.equal(nueva.motivo, "El motivo anterior tenía un error de escritura");

    // Ninguna de las dos filas previas se toca — append-only real.
    const f1 = admin._state.tables.academia_fichajes.find((f) => f.id === "f1");
    const f2 = admin._state.tables.academia_fichajes.find((f) => f.id === "f2");
    assert.equal(f1.origen, "worker");
    assert.equal(f2.motivo, "Se le olvidó fichar");
    assert.equal(admin._state.tables.academia_fichajes.length, 3);
  });

  test("guarda las notas opcionales cuando se envían", async () => {
    const admin = makeFakeSupabaseAdmin({});
    const resultado = await registrarCorreccion(admin, {
      tenantId: TENANT_ID, workerProfileId: WORKER_ID, tipo: "entrada",
      motivo: "Se le olvidó fichar", corregidoPor: ADMIN_ID,
      notas: "Confirmado con el compañero de guardia.",
    });
    assert.equal(resultado.ok, true, resultado.motivo);
    const fila = admin._state.tables.academia_fichajes[0];
    assert.equal(fila.notas, "Confirmado con el compañero de guardia.");
  });

  test("sin notas -> se guarda null, nunca undefined ni cadena vacía", async () => {
    const admin = makeFakeSupabaseAdmin({});
    await registrarCorreccion(admin, {
      tenantId: TENANT_ID, workerProfileId: WORKER_ID, tipo: "entrada",
      motivo: "Se le olvidó fichar", corregidoPor: ADMIN_ID,
    });
    const fila = admin._state.tables.academia_fichajes[0];
    assert.equal(fila.notas, null);
  });

  test("funciona aunque ni el trabajador ni el admin que corrige tengan fila previa en profiles", async () => {
    const admin = makeFakeSupabaseAdmin({ profiles: [] });
    const resultado = await registrarCorreccion(admin, {
      tenantId: TENANT_ID, tenantSlug: TENANT_SLUG, workerProfileId: WORKER_ID, tipo: "entrada",
      motivo: "Se le olvidó fichar", corregidoPor: ADMIN_ID,
    });
    assert.equal(resultado.ok, true, resultado.motivo);
    assert.ok(admin._state.tables.profiles.find((p) => p.id === WORKER_ID));
    assert.ok(admin._state.tables.profiles.find((p) => p.id === ADMIN_ID));
  });

  // REGRESIÓN — mismo caso que fichar.test.mjs: al autocurar CUALQUIERA de
  // las dos filas (worker_profile_id o corregido_por), si esa persona ya
  // tenía nombre en teacher_profiles, no debe quedar en NULL.
  test("al autocurar la fila del trabajador corregido, resuelve el nombre real desde teacher_profiles del tenant", async () => {
    const admin = makeFakeSupabaseAdmin({
      profiles: [],
      teacher_profiles: [{ id: "tp-1", user_id: WORKER_ID, tenant_slug: TENANT_SLUG, display_name: "Profe Sin Redeem" }],
    });
    const resultado = await registrarCorreccion(admin, {
      tenantId: TENANT_ID, tenantSlug: TENANT_SLUG, workerProfileId: WORKER_ID, tipo: "entrada",
      motivo: "Se le olvidó fichar", corregidoPor: ADMIN_ID,
    });
    assert.equal(resultado.ok, true, resultado.motivo);
    const perfilWorker = admin._state.tables.profiles.find((p) => p.id === WORKER_ID);
    assert.equal(perfilWorker.display_name, "Profe Sin Redeem");
    const perfilAdmin = admin._state.tables.profiles.find((p) => p.id === ADMIN_ID);
    assert.equal(perfilAdmin.display_name, null, "el admin no tiene fila en teacher_profiles, se queda en null");
  });

  test("si el INSERT falla, el resultado conserva el error real de Supabase", async () => {
    const errorReal = { code: "23503", message: "violates foreign key constraint", hint: null, details: "" };
    const admin = conInsertQueFalla(makeFakeSupabaseAdmin({}), "academia_fichajes", errorReal);
    const resultado = await registrarCorreccion(admin, {
      tenantId: TENANT_ID, workerProfileId: WORKER_ID, tipo: "entrada",
      motivo: "Se le olvidó fichar", corregidoPor: ADMIN_ID,
    });
    assert.equal(resultado.ok, false);
    assert.equal(resultado.code, "correccion_failed");
    assert.deepEqual(resultado.error, errorReal);
  });
}
