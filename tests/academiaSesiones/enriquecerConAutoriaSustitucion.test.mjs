export async function run({ test, assert }) {
  const { enriquecerConAutoriaSustitucion } = await import("../../server/routes/v1/academia.sesiones.routes.js");

  test("decora entry.sesion.en_sustitucion_de cuando derivarFn devuelve info", async () => {
    const alumnos = [
      { alumno_id: "a1", sesion: { fecha: "2026-07-26", profesor_id: "profesor-x" } },
      { alumno_id: "a2", sesion: { fecha: "2026-07-26", profesor_id: "profesor-y" } },
      { alumno_id: "a3", sesion: null },
    ];
    const llamadas = [];
    const derivarFn = async (admin, args) => {
      llamadas.push(args.alumnoId);
      if (args.alumnoId === "a1") return { profesor_sustituido_id: "profesor-z", sustituido_nombre: "Zoe" };
      return null;
    };
    const resultado = await enriquecerConAutoriaSustitucion({}, { tenantId: "t1", alumnos, derivarFn });

    assert.deepEqual(resultado[0].sesion.en_sustitucion_de, { profesor_sustituido_id: "profesor-z", sustituido_nombre: "Zoe" });
    assert.equal(resultado[1].sesion.en_sustitucion_de, undefined);
    assert.deepEqual(llamadas.sort(), ["a1", "a2"], "no debe intentar derivar autoría para un alumno sin sesión");
  });

  test("sin ninguna sesión con profesor_id -> no llama a derivarFn en absoluto", async () => {
    const alumnos = [{ alumno_id: "a1", sesion: null }, { alumno_id: "a2", sesion: { fecha: "2026-07-26" } }];
    let llamadas = 0;
    const derivarFn = async () => { llamadas++; return null; };
    await enriquecerConAutoriaSustitucion({}, { tenantId: "t1", alumnos, derivarFn });
    assert.equal(llamadas, 0);
  });
}
