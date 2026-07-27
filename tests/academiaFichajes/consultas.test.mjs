import { makeFakeSupabaseAdmin } from "../support/fakeSupabaseAdmin.mjs";

export async function run({ test, assert }) {
  const {
    fetchTrabajadoresDelTenant, fetchNombreTrabajador, fetchFichajesDeTrabajador, fetchEstadoActual,
  } = await import("../../server/lib/academiaFichajes/consultas.js");

  const TENANT_ID = "t1";
  const TENANT_SLUG = "academia-demo";
  const WORKER_ID = "w1";
  // "Hoy" fijo e inyectado (fetchEstadoActual acepta `hoy` como 4º parámetro,
  // ver consultas.js) — nunca el reloj real: antes estos tests construían
  // los fixtures con `new Date()` y confiaban en que fetchEstadoActual leyera
  // "ahora" en el mismo instante, lo cual era casi siempre cierto pero no
  // garantizado (madrugada cerca de medianoche UTC). Con HOY fijo, mismo
  // resultado hoy, dentro de un año o a las 23:59.
  const HOY = new Date("2026-07-15T10:00:00Z");

  // Regresión de un 500 real en producción: tenant_memberships.user_id
  // referencia auth.users(id), NO profiles(id) (ver 001_init.sql) — no hay
  // FK entre esas dos tablas que PostgREST pueda resolver, así que un
  // embed `profiles(...)` sobre tenant_memberships fallaba siempre (no
  // solo cuando falta la fila). "profiles" va sembrado como tabla propia
  // (no anidado dentro de tenant_memberships) para que este test hubiera
  // fallado con la query vieja rota, y confirmar que la nueva (dos
  // consultas separadas) sí funciona.
  test("fetchTrabajadoresDelTenant solo incluye admin/teacher activos del tenant", async () => {
    const admin = makeFakeSupabaseAdmin({
      tenant_memberships: [
        { user_id: "w1", tenant_id: TENANT_ID, role: "admin", status: "active" },
        { user_id: "w2", tenant_id: TENANT_ID, role: "teacher", status: "active" },
        { user_id: "w3", tenant_id: TENANT_ID, role: "student", status: "active" },
        { user_id: "w4", tenant_id: TENANT_ID, role: "admin", status: "inactive" },
        { user_id: "w5", tenant_id: "otro", role: "admin", status: "active" },
      ],
      profiles: [
        { id: "w1", display_name: "Ana" },
        { id: "w2", display_name: "Luis" },
        { id: "w3", display_name: "Alumno" },
        { id: "w4", display_name: "Baja" },
        { id: "w5", display_name: "Otro centro" },
      ],
    });
    const { trabajadores, error } = await fetchTrabajadoresDelTenant(admin, TENANT_ID, TENANT_SLUG);
    assert.equal(error, undefined);
    assert.deepEqual(trabajadores.map((t) => t.profileId).sort(), ["w1", "w2"]);
  });

  // El caso concreto que reportó el bug: personal de recepción (rol
  // 'admin', esa tabla no tiene un rol "recepción" aparte) sin fila en
  // profiles — p.ej. dado de alta a mano en el centro, no por el flujo de
  // invitación normal. No debe romper el listado entero, solo mostrar
  // "Sin nombre" para esa fila.
  test("un admin (recepción) sin fila en profiles NI en teacher_profiles no rompe el listado — cae a 'Sin nombre'", async () => {
    const admin = makeFakeSupabaseAdmin({
      tenant_memberships: [
        { user_id: "recepcion-1", tenant_id: TENANT_ID, role: "admin", status: "active" },
        { user_id: "w2", tenant_id: TENANT_ID, role: "teacher", status: "active" },
      ],
      profiles: [
        { id: "w2", display_name: "Luis" },
        // recepcion-1 no tiene fila en profiles a propósito
      ],
    });
    const { trabajadores, error } = await fetchTrabajadoresDelTenant(admin, TENANT_ID, TENANT_SLUG);
    assert.equal(error, undefined);
    const recepcion = trabajadores.find((t) => t.profileId === "recepcion-1");
    assert.ok(recepcion, "debe seguir apareciendo en el listado");
    assert.equal(recepcion.nombre, "Sin nombre");
    const luis = trabajadores.find((t) => t.profileId === "w2");
    assert.equal(luis.nombre, "Luis");
  });

  // REGRESIÓN — mismo fallback compartido (profileDisplayName.js) que ya
  // se aplicó a academiaSustituciones/consultas.js: un profesor con
  // profiles.display_name NULL pero con nombre en teacher_profiles no debe
  // mostrar "Sin nombre" — es una red de seguridad, no la solución (la
  // solución real está en ensureProfileExists, ver profileProvisioning.js).
  test("un profesor con profiles.display_name NULL cae a teacher_profiles del mismo tenant, no a 'Sin nombre'", async () => {
    const admin = makeFakeSupabaseAdmin({
      tenant_memberships: [{ user_id: "w1", tenant_id: TENANT_ID, role: "teacher", status: "active" }],
      profiles: [{ id: "w1", display_name: null }],
      teacher_profiles: [{ id: "tp-1", user_id: "w1", tenant_slug: TENANT_SLUG, display_name: "Profe Sin Redeem" }],
    });
    const { trabajadores } = await fetchTrabajadoresDelTenant(admin, TENANT_ID, TENANT_SLUG);
    assert.equal(trabajadores[0].nombre, "Profe Sin Redeem");
  });

  test("sin ningún trabajador en el tenant -> lista vacía, no llega a consultar profiles", async () => {
    const admin = makeFakeSupabaseAdmin({ tenant_memberships: [] });
    const { trabajadores, error } = await fetchTrabajadoresDelTenant(admin, TENANT_ID, TENANT_SLUG);
    assert.equal(error, undefined);
    assert.deepEqual(trabajadores, []);
  });

  test("fetchNombreTrabajador: mismo problema y mismo fix — funciona sin fila en profiles", async () => {
    const admin = makeFakeSupabaseAdmin({
      tenant_memberships: [{ user_id: "recepcion-1", tenant_id: TENANT_ID, role: "admin", status: "active" }],
      profiles: [],
    });
    const { nombre, error } = await fetchNombreTrabajador(admin, TENANT_ID, TENANT_SLUG, "recepcion-1");
    assert.equal(error, undefined);
    assert.equal(nombre, "Sin nombre");
  });

  test("fetchNombreTrabajador: con fila en profiles, devuelve el display_name real", async () => {
    const admin = makeFakeSupabaseAdmin({
      tenant_memberships: [{ user_id: "w1", tenant_id: TENANT_ID, role: "teacher", status: "active" }],
      profiles: [{ id: "w1", display_name: "Ana" }],
    });
    const { nombre } = await fetchNombreTrabajador(admin, TENANT_ID, TENANT_SLUG, "w1");
    assert.equal(nombre, "Ana");
  });

  test("fetchNombreTrabajador: worker que no pertenece a este tenant -> 'Sin nombre', no filtra por otro centro", async () => {
    const admin = makeFakeSupabaseAdmin({
      tenant_memberships: [{ user_id: "w1", tenant_id: "otro-tenant", role: "teacher", status: "active" }],
      profiles: [{ id: "w1", display_name: "Ana" }],
    });
    const { nombre } = await fetchNombreTrabajador(admin, TENANT_ID, TENANT_SLUG, "w1");
    assert.equal(nombre, "Sin nombre");
  });

  test("fetchNombreTrabajador: profiles.display_name NULL cae a teacher_profiles del mismo tenant", async () => {
    const admin = makeFakeSupabaseAdmin({
      tenant_memberships: [{ user_id: "w1", tenant_id: TENANT_ID, role: "teacher", status: "active" }],
      profiles: [{ id: "w1", display_name: null }],
      teacher_profiles: [{ id: "tp-1", user_id: "w1", tenant_slug: TENANT_SLUG, display_name: "Profe Sin Redeem" }],
    });
    const { nombre } = await fetchNombreTrabajador(admin, TENANT_ID, TENANT_SLUG, "w1");
    assert.equal(nombre, "Profe Sin Redeem");
  });

  test("fetchEstadoActual: sin fichajes hoy, está 'fuera'", async () => {
    const admin = makeFakeSupabaseAdmin({ academia_fichajes: [] });
    const { dentro, ultimoTipo } = await fetchEstadoActual(admin, TENANT_ID, WORKER_ID, HOY);
    assert.equal(dentro, false);
    assert.equal(ultimoTipo, null);
  });

  test("fetchEstadoActual: última fichaje de hoy es 'entrada' => dentro", async () => {
    const admin = makeFakeSupabaseAdmin({
      academia_fichajes: [
        { id: "f1", tenant_id: TENANT_ID, worker_profile_id: WORKER_ID, tipo: "entrada", timestamp_servidor: HOY.toISOString() },
      ],
    });
    const { dentro, ultimoTipo } = await fetchEstadoActual(admin, TENANT_ID, WORKER_ID, HOY);
    assert.equal(dentro, true);
    assert.equal(ultimoTipo, "entrada");
  });

  test("fetchEstadoActual: una corrección de admin también cuenta para el estado", async () => {
    const admin = makeFakeSupabaseAdmin({
      academia_fichajes: [
        { id: "f1", tenant_id: TENANT_ID, worker_profile_id: WORKER_ID, tipo: "entrada", origen: "admin_correccion", timestamp_servidor: HOY.toISOString() },
      ],
    });
    const { dentro } = await fetchEstadoActual(admin, TENANT_ID, WORKER_ID, HOY);
    assert.equal(dentro, true);
  });

  // Base del FAB de fichaje (ver assets/shared/js/fichaje/ficharFabEstado.js):
  // haFichadoEntradaHoy no es lo mismo que "dentro" — alguien que ya fichó
  // entrada Y salida hoy está "fuera" (dentro:false) pero SÍ fichó
  // entrada, así que el FAB NO debe volver a modo "pendiente" solo por eso.
  test("fetchEstadoActual: sin ningún fichaje hoy -> haFichadoEntradaHoy false", async () => {
    const admin = makeFakeSupabaseAdmin({ academia_fichajes: [] });
    const { haFichadoEntradaHoy } = await fetchEstadoActual(admin, TENANT_ID, WORKER_ID, HOY);
    assert.equal(haFichadoEntradaHoy, false);
  });

  test("fetchEstadoActual: ya fichó entrada y salida hoy -> fuera, pero SÍ fichó entrada", async () => {
    // Horas fijas de la madrugada de HOY (no relativas a la hora actual):
    // así el test nunca es intermitente cerca de medianoche UTC, igual
    // que el resto de tests de este archivo construyen fechas con
    // Date.UTC en vez de restar horas a "ahora".
    const entrada = new Date(Date.UTC(HOY.getUTCFullYear(), HOY.getUTCMonth(), HOY.getUTCDate(), 1, 0)).toISOString();
    const salida = new Date(Date.UTC(HOY.getUTCFullYear(), HOY.getUTCMonth(), HOY.getUTCDate(), 2, 0)).toISOString();
    const admin = makeFakeSupabaseAdmin({
      academia_fichajes: [
        { id: "f1", tenant_id: TENANT_ID, worker_profile_id: WORKER_ID, tipo: "entrada", timestamp_servidor: entrada },
        { id: "f2", tenant_id: TENANT_ID, worker_profile_id: WORKER_ID, tipo: "salida", timestamp_servidor: salida },
      ],
    });
    const { dentro, haFichadoEntradaHoy } = await fetchEstadoActual(admin, TENANT_ID, WORKER_ID, HOY);
    assert.equal(dentro, false, "el último fichaje de hoy es salida, está fuera");
    assert.equal(haFichadoEntradaHoy, true, "pero sí fichó entrada hoy — el banner no debe reaparecerle");
  });

  test("fetchEstadoActual: solo fichó entrada hoy (sigue dentro) -> haFichadoEntradaHoy true", async () => {
    const admin = makeFakeSupabaseAdmin({
      academia_fichajes: [
        { id: "f1", tenant_id: TENANT_ID, worker_profile_id: WORKER_ID, tipo: "entrada", timestamp_servidor: HOY.toISOString() },
      ],
    });
    const { dentro, haFichadoEntradaHoy } = await fetchEstadoActual(admin, TENANT_ID, WORKER_ID, HOY);
    assert.equal(dentro, true);
    assert.equal(haFichadoEntradaHoy, true);
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
          corregido_por: "admin1",
        },
      ],
      profiles: [{ id: "admin1", display_name: "María Admin" }],
    });
    const { fichajes, error } = await fetchFichajesDeTrabajador(admin, TENANT_ID, TENANT_SLUG, WORKER_ID, { mes: 7, anio: 2026 });
    assert.equal(error, undefined);
    assert.equal(fichajes.length, 2, "original y corrección deben venir como dos filas, no una fusionada");
    const correccion = fichajes.find((f) => f.origen === "admin_correccion");
    assert.equal(correccion.motivo, "Se le olvidó fichar la salida");
    assert.equal(correccion.corregidoPorNombre, "María Admin");
    const original = fichajes.find((f) => f.origen === "worker");
    assert.equal(original.motivo, null);
    assert.equal(original.corregidoPorNombre, null, "sin corrección -> null, no 'Sin nombre'");
  });

  // REGRESIÓN — mismo fallback compartido (profileDisplayName.js) que ya
  // usan fetchTrabajadoresDelTenant/fetchNombreTrabajador: antes, el
  // "corregido por" salía de un embed `profiles!...fkey(display_name)`
  // que nunca caía a teacher_profiles, así que un admin/recepción sin
  // fila (o sin nombre) en profiles aparecía como "corregido por: null".
  test("corrección hecha por un admin sin display_name en profiles cae a teacher_profiles del mismo tenant", async () => {
    const admin = makeFakeSupabaseAdmin({
      academia_fichajes: [
        {
          id: "f1", tenant_id: TENANT_ID, worker_profile_id: WORKER_ID, tipo: "salida",
          origen: "admin_correccion", timestamp_servidor: "2026-07-05T17:00:00.000Z",
          motivo: "Se le olvidó fichar", corregido_por: "admin1",
        },
      ],
      profiles: [{ id: "admin1", display_name: null }],
      teacher_profiles: [{ id: "tp-1", user_id: "admin1", tenant_slug: TENANT_SLUG, display_name: "Profe Sin Redeem" }],
    });
    const { fichajes } = await fetchFichajesDeTrabajador(admin, TENANT_ID, TENANT_SLUG, WORKER_ID, { mes: 7, anio: 2026 });
    assert.equal(fichajes[0].corregidoPorNombre, "Profe Sin Redeem");
  });

  test("corrección sin nombre en profiles NI en teacher_profiles -> 'Sin nombre', nunca null ni vacío", async () => {
    const admin = makeFakeSupabaseAdmin({
      academia_fichajes: [
        {
          id: "f1", tenant_id: TENANT_ID, worker_profile_id: WORKER_ID, tipo: "salida",
          origen: "admin_correccion", timestamp_servidor: "2026-07-05T17:00:00.000Z",
          motivo: "Se le olvidó fichar", corregido_por: "recepcion-1",
        },
      ],
      profiles: [],
    });
    const { fichajes } = await fetchFichajesDeTrabajador(admin, TENANT_ID, TENANT_SLUG, WORKER_ID, { mes: 7, anio: 2026 });
    assert.equal(fichajes[0].corregidoPorNombre, "Sin nombre");
  });

  test("fetchFichajesDeTrabajador incluye las notas opcionales de una corrección", async () => {
    const admin = makeFakeSupabaseAdmin({
      academia_fichajes: [
        {
          id: "f1", tenant_id: TENANT_ID, worker_profile_id: WORKER_ID, tipo: "salida",
          origen: "admin_correccion", timestamp_servidor: "2026-07-05T17:00:00.000Z",
          motivo: "Se le olvidó fichar", notas: "Confirmado con el compañero de guardia.",
          corregido_por: "admin1",
        },
      ],
      profiles: [{ id: "admin1", display_name: "María Admin" }],
    });
    const { fichajes } = await fetchFichajesDeTrabajador(admin, TENANT_ID, TENANT_SLUG, WORKER_ID, { mes: 7, anio: 2026 });
    assert.equal(fichajes[0].notas, "Confirmado con el compañero de guardia.");
  });

  test("fetchFichajesDeTrabajador: sin notas -> null, no cadena vacía ni undefined", async () => {
    const admin = makeFakeSupabaseAdmin({
      academia_fichajes: [
        { id: "f1", tenant_id: TENANT_ID, worker_profile_id: WORKER_ID, tipo: "entrada", origen: "worker", timestamp_servidor: "2026-07-05T08:00:00.000Z" },
      ],
    });
    const { fichajes } = await fetchFichajesDeTrabajador(admin, TENANT_ID, TENANT_SLUG, WORKER_ID, { mes: 7, anio: 2026 });
    assert.equal(fichajes[0].notas, null);
  });

  test("fetchFichajesDeTrabajador filtra fuera del rango del mes pedido", async () => {
    const admin = makeFakeSupabaseAdmin({
      academia_fichajes: [
        { id: "f1", tenant_id: TENANT_ID, worker_profile_id: WORKER_ID, tipo: "entrada", origen: "worker", timestamp_servidor: "2026-06-30T23:59:00.000Z" },
        { id: "f2", tenant_id: TENANT_ID, worker_profile_id: WORKER_ID, tipo: "entrada", origen: "worker", timestamp_servidor: "2026-07-01T00:00:00.000Z" },
      ],
    });
    const { fichajes } = await fetchFichajesDeTrabajador(admin, TENANT_ID, TENANT_SLUG, WORKER_ID, { mes: 7, anio: 2026 });
    assert.equal(fichajes.length, 1);
    assert.equal(fichajes[0].id, "f2");
  });
}
