import { makeFakeSupabaseAdmin } from "../support/fakeSupabaseAdmin.mjs";

// El fake compartido no implementa `.delete()` (mismo motivo documentado en
// academiaRecibos/regenerarConDescuentos.test.mjs: nadie más lo necesitaba
// hasta ahora) — soporte mínimo local en vez de tocar el fake compartido,
// generalizado a cualquier número de `.eq()` encadenados (quitarAlumno
// encadena tres: tenant_id, profesor_id, alumno_id).
function conSoporteDeDelete(admin) {
  return {
    from(table) {
      const builder = admin.from(table);
      builder.delete = () => {
        const filtros = [];
        const encadenable = {
          eq(col, val) {
            filtros.push([col, val]);
            return encadenable;
          },
          then(resolve, reject) {
            admin._state.tables[table] = (admin._state.tables[table] || []).filter(
              (r) => !filtros.every(([col, val]) => r[col] === val)
            );
            return Promise.resolve({ data: null, error: null }).then(resolve, reject);
          },
        };
        return encadenable;
      };
      return builder;
    },
    _state: admin._state,
  };
}

export async function run({ test, assert }) {
  const {
    fetchAlumnosActivosDelTenant, fetchAlumnosDeProfesor, asignarAlumno, quitarAlumno,
  } = await import("../../server/lib/academiaProfesores/asignaciones.js");

  const TENANT_ID = "t1";
  const PROFESOR_ID = "profesor-1";
  const ALUMNO_ID = "alumno-1";

  test("fetchAlumnosActivosDelTenant solo trae alumnos activos del tenant", async () => {
    const admin = makeFakeSupabaseAdmin({
      academia_alumnos: [
        { id: "a1", tenant_id: TENANT_ID, nombre: "Ana", curso: "1 ESO", activo: true },
        { id: "a2", tenant_id: TENANT_ID, nombre: "Bea", curso: "2 ESO", activo: false },
        { id: "a3", tenant_id: "otro", nombre: "Carlos", curso: "1 ESO", activo: true },
      ],
    });
    const { alumnos, error } = await fetchAlumnosActivosDelTenant(admin, TENANT_ID);
    assert.equal(error, undefined);
    assert.deepEqual(alumnos.map((a) => a.id), ["a1"]);
  });

  test("asignarAlumno rechaza un alumno que no pertenece al tenant", async () => {
    const admin = makeFakeSupabaseAdmin({
      academia_alumnos: [{ id: ALUMNO_ID, tenant_id: "otro-tenant", nombre: "Ana", activo: true }],
    });
    const resultado = await asignarAlumno(admin, { tenantId: TENANT_ID, profesorId: PROFESOR_ID, alumnoId: ALUMNO_ID });
    assert.equal(resultado.ok, false);
    assert.equal(resultado.code, "alumno_not_found");
    assert.equal((admin._state.tables.academia_profesor_alumnos || []).length, 0);
  });

  test("asignarAlumno inserta la relación cuando el alumno sí pertenece al tenant", async () => {
    const admin = makeFakeSupabaseAdmin({
      academia_alumnos: [{ id: ALUMNO_ID, tenant_id: TENANT_ID, nombre: "Ana", activo: true }],
    });
    const resultado = await asignarAlumno(admin, { tenantId: TENANT_ID, profesorId: PROFESOR_ID, alumnoId: ALUMNO_ID });
    assert.equal(resultado.ok, true);
    const filas = admin._state.tables.academia_profesor_alumnos;
    assert.equal(filas.length, 1);
    assert.equal(filas[0].profesor_id, PROFESOR_ID);
    assert.equal(filas[0].alumno_id, ALUMNO_ID);
  });

  test("asignarAlumno dos veces al mismo alumno no revienta (upsert idempotente)", async () => {
    const admin = makeFakeSupabaseAdmin({
      academia_alumnos: [{ id: ALUMNO_ID, tenant_id: TENANT_ID, nombre: "Ana", activo: true }],
    });
    await asignarAlumno(admin, { tenantId: TENANT_ID, profesorId: PROFESOR_ID, alumnoId: ALUMNO_ID });
    const segundo = await asignarAlumno(admin, { tenantId: TENANT_ID, profesorId: PROFESOR_ID, alumnoId: ALUMNO_ID });
    assert.equal(segundo.ok, true);
  });

  test("fetchAlumnosDeProfesor devuelve solo los alumnos asignados a ese profesor", async () => {
    const admin = makeFakeSupabaseAdmin({
      academia_profesor_alumnos: [
        { id: "r1", tenant_id: TENANT_ID, profesor_id: PROFESOR_ID, alumno_id: "a1", alumno: { id: "a1", nombre: "Ana", curso: "1 ESO" } },
        { id: "r2", tenant_id: TENANT_ID, profesor_id: "otro-profesor", alumno_id: "a2", alumno: { id: "a2", nombre: "Bea", curso: "2 ESO" } },
      ],
    });
    const { alumnos, error } = await fetchAlumnosDeProfesor(admin, TENANT_ID, PROFESOR_ID);
    assert.equal(error, undefined);
    assert.equal(alumnos.length, 1);
    assert.equal(alumnos[0].nombre, "Ana");
  });

  test("quitarAlumno elimina la relación", async () => {
    const base = makeFakeSupabaseAdmin({
      academia_profesor_alumnos: [
        { id: "r1", tenant_id: TENANT_ID, profesor_id: PROFESOR_ID, alumno_id: ALUMNO_ID },
        { id: "r2", tenant_id: TENANT_ID, profesor_id: PROFESOR_ID, alumno_id: "otro-alumno" },
      ],
    });
    const admin = conSoporteDeDelete(base);
    const resultado = await quitarAlumno(admin, { tenantId: TENANT_ID, profesorId: PROFESOR_ID, alumnoId: ALUMNO_ID });
    assert.equal(resultado.ok, true);
    const restantes = base._state.tables.academia_profesor_alumnos;
    assert.equal(restantes.length, 1);
    assert.equal(restantes[0].alumno_id, "otro-alumno");
  });
}
