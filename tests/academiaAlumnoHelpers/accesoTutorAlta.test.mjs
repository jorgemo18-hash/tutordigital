// REGRESIÓN: un centro que todavía no ha repartido el tutor no debe verse
// obligado a poner un email al alumno para poder guardarlo, ni provocar que
// se le envíe una invitación a un tutor que no existe para él.
//
// El caso real: Lyceo arranca el curso en septiembre usando solo gestión y
// no da el tutor hasta enero. Antes de la migración 105, dar de alta a un
// alumno exigía su email Y disparaba el correo "Tu acceso a TutorDigital"
// con un enlace para fijar contraseña — 40 correos a familias sobre algo
// que no iban a poder usar en cuatro meses.
export async function run({ test, assert }) {
  const { buildAlumnoCreateSchema, AlumnoCreateSchema } = await import(
    "../../server/lib/academiaAlumnoSchemas.js"
  );
  const { fetchAccesoTutorActivo } = await import("../../server/lib/academiaConfig/accesoTutor.js");

  const alumno = {
    nombre: "Ana García",
    curso: "1º ESO",
    fecha_alta: "2026-09-08",
    familia_id: "11111111-1111-1111-1111-111111111111",
  };

  test("REGRESIÓN: tutor apagado -> se puede guardar un alumno activo sin email", () => {
    const schema = buildAlumnoCreateSchema({ exigeEmailAlumno: false });
    assert.equal(schema.safeParse(alumno).success, true);
  });

  test("tutor encendido -> el email vuelve a ser obligatorio", () => {
    const schema = buildAlumnoCreateSchema({ exigeEmailAlumno: true });
    const res = schema.safeParse(alumno);
    assert.equal(res.success, false);
    assert.equal(res.error.issues[0].path[0], "email");
  });

  test("el esquema por defecto sigue exigiendo el email (centro con tutor)", () => {
    assert.equal(AlumnoCreateSchema.safeParse(alumno).success, false);
    assert.equal(AlumnoCreateSchema.safeParse({ ...alumno, email: "ana@example.com" }).success, true);
  });

  test("un borrador nunca exige email, con el tutor encendido o apagado", () => {
    const borrador = { ...alumno, activo: false };
    for (const exige of [true, false]) {
      assert.equal(buildAlumnoCreateSchema({ exigeEmailAlumno: exige }).safeParse(borrador).success, true);
    }
  });

  test("el email de la FAMILIA se exige siempre — ahí van recibos e informes", () => {
    const conFamiliaSinEmail = {
      ...alumno,
      familia_id: undefined,
      familia_nueva: { nombre: "Familia García" },
    };
    const res = buildAlumnoCreateSchema({ exigeEmailAlumno: false }).safeParse(conFamiliaSinEmail);
    assert.equal(res.success, false, "el tutor apagado no relaja el email de la familia");
    assert.deepEqual(res.error.issues[0].path, ["familia_nueva", "email"]);
  });

  // fetchAccesoTutorActivo: ante la duda, apagado. Un email de más no se
  // puede retirar; un alumno guardado sin acceso se arregla encendiendo el
  // interruptor y volviendo a guardar.
  function fakeAdmin({ data = null, error = null } = {}) {
    return {
      from() {
        const q = { select: () => q, eq: () => q, maybeSingle: async () => ({ data, error }) };
        return q;
      },
    };
  }

  test("acceso_tutor_activo true -> true", async () => {
    assert.equal(await fetchAccesoTutorActivo(fakeAdmin({ data: { acceso_tutor_activo: true } }), "t1"), true);
  });

  test("sin fila de configuración -> false, no se envía nada", async () => {
    assert.equal(await fetchAccesoTutorActivo(fakeAdmin({ data: null }), "t1"), false);
  });

  test("error de base de datos -> false, nunca se asume que hay tutor", async () => {
    assert.equal(await fetchAccesoTutorActivo(fakeAdmin({ error: { message: "boom" } }), "t1"), false);
  });
}
