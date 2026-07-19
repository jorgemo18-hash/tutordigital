import { makeFakeSupabaseAdmin } from "../support/fakeSupabaseAdmin.mjs";

// fetchHermanosConDescuentosActivos(): quién queda activo en la familia
// (excluyendo al recién archivado) con al menos un descuento recurrente
// activo — para el aviso no bloqueante de TAREA 1. Solo informa, nunca
// desactiva nada (ver academia.alumnos.archivar.routes.js).
export async function run({ test, assert }) {
  const { fetchHermanosConDescuentosActivos } = await import("../../server/lib/academiaDescuentos/consultas.js");

  test("hermano activo con descuento activo -> aparece con su nombre y descuento", async () => {
    const admin = makeFakeSupabaseAdmin({
      academia_alumnos: [
        { id: "a1", tenant_id: "t1", familia_id: "f1", nombre: "Ana", activo: true },
        { id: "a2", tenant_id: "t1", familia_id: "f1", nombre: "Recién archivado", activo: false },
      ],
      academia_alumno_descuentos: [{
        id: "d1", alumno_id: "a1", activo: true,
        descuento_tipo: { concepto: "Hermanos", porcentaje: 15, acumulable: true, intervalo: "siempre", tenant_id: "t1" },
      }],
    });

    const { hermanos } = await fetchHermanosConDescuentosActivos(admin, "t1", { familiaId: "f1", excluirAlumnoId: "a2" });
    assert.deepEqual(hermanos, [{ id: "a1", nombre: "Ana", descuentos: [{ concepto: "Hermanos", porcentaje: 15 }] }]);
  });

  test("hermano activo SIN ningún descuento -> no aparece en la lista", async () => {
    const admin = makeFakeSupabaseAdmin({
      academia_alumnos: [{ id: "a1", tenant_id: "t1", familia_id: "f1", nombre: "Ana", activo: true }],
      academia_alumno_descuentos: [],
    });
    const { hermanos } = await fetchHermanosConDescuentosActivos(admin, "t1", { familiaId: "f1", excluirAlumnoId: "otro" });
    assert.deepEqual(hermanos, []);
  });

  test("el propio alumno archivado nunca se lista, aunque tuviera descuentos", async () => {
    const admin = makeFakeSupabaseAdmin({
      academia_alumnos: [{ id: "a1", tenant_id: "t1", familia_id: "f1", nombre: "Ana", activo: true }],
      academia_alumno_descuentos: [{
        id: "d1", alumno_id: "a1", activo: true,
        descuento_tipo: { concepto: "Hermanos", porcentaje: 15, acumulable: true, intervalo: "siempre", tenant_id: "t1" },
      }],
    });
    const { hermanos } = await fetchHermanosConDescuentosActivos(admin, "t1", { familiaId: "f1", excluirAlumnoId: "a1" });
    assert.deepEqual(hermanos, []);
  });

  test("descuento asignado pero inactivo (activo:false) -> no cuenta para el aviso", async () => {
    const admin = makeFakeSupabaseAdmin({
      academia_alumnos: [{ id: "a1", tenant_id: "t1", familia_id: "f1", nombre: "Ana", activo: true }],
      academia_alumno_descuentos: [{
        id: "d1", alumno_id: "a1", activo: false,
        descuento_tipo: { concepto: "Hermanos", porcentaje: 15, acumulable: true, intervalo: "siempre", tenant_id: "t1" },
      }],
    });
    const { hermanos } = await fetchHermanosConDescuentosActivos(admin, "t1", { familiaId: "f1", excluirAlumnoId: "otro" });
    assert.deepEqual(hermanos, []);
  });

  test("varios hermanos con varios descuentos cada uno -> todos listados con su desglose completo", async () => {
    const admin = makeFakeSupabaseAdmin({
      academia_alumnos: [
        { id: "a1", tenant_id: "t1", familia_id: "f1", nombre: "Ana", activo: true },
        { id: "a2", tenant_id: "t1", familia_id: "f1", nombre: "Luis", activo: true },
      ],
      academia_alumno_descuentos: [
        { id: "d1", alumno_id: "a1", activo: true, descuento_tipo: { concepto: "Hermanos", porcentaje: 15, acumulable: true, intervalo: "siempre", tenant_id: "t1" } },
        { id: "d2", alumno_id: "a1", activo: true, descuento_tipo: { concepto: "Primer mes", porcentaje: 20, acumulable: true, intervalo: "primer_mes", tenant_id: "t1" } },
        { id: "d3", alumno_id: "a2", activo: true, descuento_tipo: { concepto: "Hermanos", porcentaje: 15, acumulable: true, intervalo: "siempre", tenant_id: "t1" } },
      ],
    });
    const { hermanos } = await fetchHermanosConDescuentosActivos(admin, "t1", { familiaId: "f1", excluirAlumnoId: "otro" });
    assert.equal(hermanos.length, 2);
    assert.equal(hermanos.find((h) => h.nombre === "Ana").descuentos.length, 2);
    assert.equal(hermanos.find((h) => h.nombre === "Luis").descuentos.length, 1);
  });

  test("sin familiaId (alumno sin familia asignada) -> lista vacía, no revienta", async () => {
    const admin = makeFakeSupabaseAdmin({ academia_alumnos: [], academia_alumno_descuentos: [] });
    const { hermanos } = await fetchHermanosConDescuentosActivos(admin, "t1", { familiaId: null, excluirAlumnoId: "a1" });
    assert.deepEqual(hermanos, []);
  });

  test("familia sin ningún otro alumno activo -> lista vacía", async () => {
    const admin = makeFakeSupabaseAdmin({
      academia_alumnos: [{ id: "a1", tenant_id: "t1", familia_id: "f1", nombre: "El archivado", activo: false }],
      academia_alumno_descuentos: [],
    });
    const { hermanos } = await fetchHermanosConDescuentosActivos(admin, "t1", { familiaId: "f1", excluirAlumnoId: "a1" });
    assert.deepEqual(hermanos, []);
  });
}
