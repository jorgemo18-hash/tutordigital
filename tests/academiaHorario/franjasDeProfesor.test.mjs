import { makeFakeSupabaseAdmin } from "../support/fakeSupabaseAdmin.mjs";

// Paso 3 del horario por profesor: qué ve un PROFESOR cuando la franja dice
// quién la imparte.
//
// Regla decidida por Jorge (29/08) con su caso real: "si es por sustitución,
// María no está y se la pasa a Pedro, la ven los dos; si es porque da una
// clase con uno y otra con otro, solo al que le toca".
//
//   - franja CON profesor -> la ve quien la imparte, y nadie más;
//   - franja SIN profesor -> como siempre: la ven los profesores a los que
//     está asignado el alumno (cero regresión para quien nunca rellene el
//     campo, que era la condición del cambio);
//   - sustitución -> SUMA: el sustituto ve además las del sustituido.
export async function run({ test, assert }) {
  const { franjaVisibleParaProfesor, filtrarFranjasDeProfesor, fetchAlumnoIdsDeFranjasDeProfesor } =
    await import("../../server/lib/academiaProfesores/franjasDeProfesor.js");
  const { fetchFranjasVisibles } = await import("../../server/routes/v1/academia.horario.routes.js");
  const { fetchDiarioVisible } = await import("../../server/routes/v1/academia.sesiones.routes.js");

  const TENANT_ID = "tenant-1";
  const TENANT_SLUG = "academia-demo";
  const USER_ID = "user-maria";
  const MARIA = "profesor-maria";
  const PEDRO = "profesor-pedro";

  // ── La regla, en seco ─────────────────────────────────────────────────

  const ambitoDeMaria = { profesorIds: [MARIA], alumnoIdsAsignados: ["marta"] };

  test("una franja sin profesor la ve quien tiene al alumno ASIGNADO", () => {
    // Es el caso de toda academia que nunca rellene el campo: se comporta
    // exactamente como antes de la migración 109.
    assert.equal(franjaVisibleParaProfesor({ profesor_id: null, alumno_id: "marta" }, ambitoDeMaria), true);
    assert.equal(franjaVisibleParaProfesor({ alumno_id: "marta" }, ambitoDeMaria), true);
  });

  test("REGRESIÓN: una franja sin profesor de un alumno que NO es mío tampoco es mía", () => {
    // El caso fino: Pedro imparte el jueves de Marta (así que la ve), pero
    // el viernes de Marta está sin asignar y Marta es alumna de María. Ese
    // viernes NO es de Pedro.
    const ambitoDePedro = { profesorIds: [PEDRO], alumnoIdsAsignados: [] };
    assert.equal(franjaVisibleParaProfesor({ profesor_id: null, alumno_id: "marta" }, ambitoDePedro), false);
  });

  test("una franja con MI nombre la veo", () => {
    assert.equal(franjaVisibleParaProfesor({ profesor_id: MARIA }, ambitoDeMaria), true);
  });

  test("REGRESIÓN: la franja de OTRO profesor no la veo, aunque el alumno sea mío", () => {
    // Es justo lo que evita que dos profesores escriban el mismo parte:
    // solo hay UNA sesión por alumno y día.
    assert.equal(franjaVisibleParaProfesor({ profesor_id: PEDRO, alumno_id: "marta" }, ambitoDeMaria), false);
  });

  test("sustituyendo a Pedro, sus franjas sí se ven", () => {
    const cubriendo = { profesorIds: [MARIA, PEDRO], alumnoIdsAsignados: ["marta"] };
    assert.equal(franjaVisibleParaProfesor({ profesor_id: PEDRO, alumno_id: "marta" }, cubriendo), true);
  });

  test("sin ámbito de profesor (un admin gestionando) no se filtra nada", () => {
    assert.equal(franjaVisibleParaProfesor({ profesor_id: PEDRO }, null), true);
    assert.equal(filtrarFranjasDeProfesor([{ profesor_id: PEDRO }, { profesor_id: MARIA }], null).length, 2);
  });

  // ── Los alumnos de mis franjas ────────────────────────────────────────

  test("los alumnos de las franjas que imparto entran en mi conjunto visible", async () => {
    // Pedro imparte el jueves de Marta, que está asignada a María. Sin
    // esto, Pedro vería la clase y no podría escribir el parte.
    const admin = makeFakeSupabaseAdmin({
      academia_horario: [
        { id: "h1", tenant_id: TENANT_ID, alumno_id: "marta", profesor_id: PEDRO, fecha_fin: null },
        { id: "h2", tenant_id: TENANT_ID, alumno_id: "otro", profesor_id: MARIA, fecha_fin: null },
      ],
    });
    const { alumnoIds } = await fetchAlumnoIdsDeFranjasDeProfesor(admin, TENANT_ID, [PEDRO]);
    assert.deepEqual(alumnoIds, ["marta"]);
  });

  test("una franja ya cerrada (fecha_fin) no arrastra a su alumno", async () => {
    const admin = makeFakeSupabaseAdmin({
      academia_horario: [
        { id: "h1", tenant_id: TENANT_ID, alumno_id: "marta", profesor_id: PEDRO, fecha_fin: "2026-06-30" },
      ],
    });
    const { alumnoIds } = await fetchAlumnoIdsDeFranjasDeProfesor(admin, TENANT_ID, [PEDRO]);
    assert.deepEqual(alumnoIds, []);
  });

  test("sin profesores que consultar no se consulta nada", async () => {
    const admin = { from: () => { throw new Error("no debería consultarse"); } };
    assert.deepEqual((await fetchAlumnoIdsDeFranjasDeProfesor(admin, TENANT_ID, [])).alumnoIds, []);
  });

  // ── El caso completo de Jorge, en el horario ──────────────────────────

  function seedMartaConDosProfesores() {
    return makeFakeSupabaseAdmin({
      academia_horario: [
        {
          id: "martes-maria", tenant_id: TENANT_ID, alumno_id: "marta", profesor_id: MARIA,
          dia_semana: 2, hora_inicio: "17:00", hora_fin: "18:00", fecha_inicio: "2026-01-01", fecha_fin: null,
          alumno: { id: "marta", nombre: "Marta", curso: "1 ESO", nivel: "eso", activo: true },
        },
        {
          id: "jueves-pedro", tenant_id: TENANT_ID, alumno_id: "marta", profesor_id: PEDRO,
          dia_semana: 4, hora_inicio: "17:00", hora_fin: "18:00", fecha_inicio: "2026-01-01", fecha_fin: null,
          alumno: { id: "marta", nombre: "Marta", curso: "1 ESO", nivel: "eso", activo: true },
        },
        {
          id: "viernes-sin-asignar", tenant_id: TENANT_ID, alumno_id: "marta", profesor_id: null,
          dia_semana: 5, hora_inicio: "17:00", hora_fin: "18:00", fecha_inicio: "2026-01-01", fecha_fin: null,
          alumno: { id: "marta", nombre: "Marta", curso: "1 ESO", nivel: "eso", activo: true },
        },
      ],
      academia_profesor_alumnos: [
        { tenant_id: TENANT_ID, profesor_id: MARIA, alumno_id: "marta" },
      ],
    });
  }

  test("REGRESIÓN: María ve su martes y el viernes sin asignar, pero NO el jueves de Pedro", async () => {
    const res = await fetchFranjasVisibles(seedMartaConDosProfesores(), {
      tenantId: TENANT_ID, tenantSlug: TENANT_SLUG, userId: USER_ID, role: "teacher",
      findProfesorIdFn: async () => MARIA,
    });
    assert.equal(res.error, undefined);
    assert.deepEqual(res.franjas.map((f) => f.id).sort(), ["martes-maria", "viernes-sin-asignar"]);
  });

  test("Pedro ve SU jueves aunque Marta no sea alumna suya", async () => {
    // Sin la tercera fuente de alumnos visibles, Pedro no vería nada: no
    // tiene ninguna asignación.
    const res = await fetchFranjasVisibles(seedMartaConDosProfesores(), {
      tenantId: TENANT_ID, tenantSlug: TENANT_SLUG, userId: "user-pedro", role: "teacher",
      findProfesorIdFn: async () => PEDRO,
    });
    assert.deepEqual(res.franjas.map((f) => f.id), ["jueves-pedro"],
      "ni el martes de María ni el viernes sin asignar, que es de quien tiene a Marta");
    assert.equal(res.sinAlumnosAsignados, false, "tiene clase que dar: la pantalla no puede decir que no tiene alumnos");
  });

  test("el admin sigue viendo el horario entero, con los dos profesores", async () => {
    const res = await fetchFranjasVisibles(seedMartaConDosProfesores(), {
      tenantId: TENANT_ID, tenantSlug: TENANT_SLUG, userId: "user-admin", role: "admin",
      findProfesorIdFn: async () => { throw new Error("no debería llamarse para un admin"); },
    });
    assert.equal(res.franjas.length, 3);
  });

  test("REGRESIÓN: un profesor sin asignaciones NI franjas propias sigue viendo [] — la regla innegociable", async () => {
    const res = await fetchFranjasVisibles(seedMartaConDosProfesores(), {
      tenantId: TENANT_ID, tenantSlug: TENANT_SLUG, userId: "user-nadie", role: "teacher",
      findProfesorIdFn: async () => "profesor-sin-nada",
    });
    assert.deepEqual(res, { franjas: [], sinAlumnosAsignados: true });
  });

  // ── Y en el diario del día ────────────────────────────────────────────

  test("REGRESIÓN: el jueves, el diario de María no trae a Marta; el de Pedro sí", async () => {
    const comun = { tenantId: TENANT_ID, tenantSlug: TENANT_SLUG, fecha: "2026-09-10", diaSemana: 4 };

    const deMaria = await fetchDiarioVisible(seedMartaConDosProfesores(), {
      ...comun, userId: USER_ID, role: "teacher", findProfesorIdFn: async () => MARIA,
    });
    assert.deepEqual(deMaria.alumnos, [], "el jueves no es suyo");

    const dePedro = await fetchDiarioVisible(seedMartaConDosProfesores(), {
      ...comun, userId: "user-pedro", role: "teacher", findProfesorIdFn: async () => PEDRO,
    });
    assert.deepEqual(dePedro.alumnos.map((a) => a.alumno_id), ["marta"]);
  });

  test("el viernes (franja sin profesor) sigue saliendo en el diario de María", async () => {
    const res = await fetchDiarioVisible(seedMartaConDosProfesores(), {
      tenantId: TENANT_ID, tenantSlug: TENANT_SLUG, userId: USER_ID, role: "teacher",
      findProfesorIdFn: async () => MARIA, fecha: "2026-09-11", diaSemana: 5,
    });
    assert.deepEqual(res.alumnos.map((a) => a.alumno_id), ["marta"]);
  });
}
