import { makeFakeSupabaseAdmin } from "../support/fakeSupabaseAdmin.mjs";

// resolverBadgesSustitucion() traduce sustitucionPorAlumnoId (solo ids,
// ver resolverAlumnosVisibles.js) a un Map con el nombre del profesor
// sustituido ya resuelto — lo que consumen horario/diario para pintar
// "Sustitución" con un tooltip que dice de quién viene el alumno.
export async function run({ test, assert }) {
  const { resolverBadgesSustitucion } = await import("../../server/lib/academiaProfesores/sustitucionBadge.js");

  test("sin sustitucionPorAlumnoId (undefined) -> Map vacío, no consulta nada", async () => {
    const admin = makeFakeSupabaseAdmin({});
    const badges = await resolverBadgesSustitucion(admin, undefined);
    assert.equal(badges.size, 0);
  });

  test("resuelve el nombre del profesor sustituido para cada alumno marcado", async () => {
    const admin = makeFakeSupabaseAdmin({
      teacher_profiles: [{ id: "profesor-sustituido", display_name: "Bea" }],
    });
    const badges = await resolverBadgesSustitucion(admin, { "alumno-1": "profesor-sustituido" });
    assert.deepEqual(badges.get("alumno-1"), { sustituido_nombre: "Bea" });
  });

  test("dos alumnos que vienen de DOS profesores distintos -> cada uno con su propio nombre", async () => {
    const admin = makeFakeSupabaseAdmin({
      teacher_profiles: [
        { id: "profesor-a", display_name: "Bea" },
        { id: "profesor-b", display_name: "Carlos" },
      ],
    });
    const badges = await resolverBadgesSustitucion(admin, {
      "alumno-1": "profesor-a",
      "alumno-2": "profesor-b",
    });
    assert.equal(badges.get("alumno-1").sustituido_nombre, "Bea");
    assert.equal(badges.get("alumno-2").sustituido_nombre, "Carlos");
  });

  test("profesor sustituido sin fila en teacher_profiles -> sustituido_nombre: null, nunca revienta", async () => {
    const admin = makeFakeSupabaseAdmin({ teacher_profiles: [] });
    const badges = await resolverBadgesSustitucion(admin, { "alumno-1": "profesor-fantasma" });
    assert.deepEqual(badges.get("alumno-1"), { sustituido_nombre: null });
  });
}
