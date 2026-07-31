import { makeFakeSupabaseAdmin } from "../support/fakeSupabaseAdmin.mjs";

export async function run({ test, assert }) {
  const { contarHuerfanos, fetchImpactoHorario } = await import("../../server/lib/academiaConfig/horarioImpacto.js");

  test("contarHuerfanos: config sin cambios (Lyceo real) -> 0 huérfanos entre sus 5 hora_inicio distintas", () => {
    const filas = [
      { hora_inicio: "15:30:00" }, { hora_inicio: "16:30:00" }, { hora_inicio: "17:30:00" },
      { hora_inicio: "18:30:00" }, { hora_inicio: "19:30:00" },
    ];
    const n = contarHuerfanos(filas, { franjaInicio: "15:30", franjaFin: "20:30", franjaDuracion: 60 });
    assert.equal(n, 0);
  });

  test("contarHuerfanos: cambiar la duración deja huérfanas las filas que ya no caen en un tramo nuevo", () => {
    // 60 -> 90 min: los nuevos tramos son 15:30, 17:00, 18:30, 20:00 —
    // 16:30/17:30/19:30 (del set de 60 min) dejan de existir en el nuevo.
    const filas = [
      { hora_inicio: "15:30:00" }, { hora_inicio: "16:30:00" }, { hora_inicio: "17:30:00" },
      { hora_inicio: "18:30:00" }, { hora_inicio: "19:30:00" },
    ];
    const n = contarHuerfanos(filas, { franjaInicio: "15:30", franjaFin: "20:30", franjaDuracion: 90 });
    assert.equal(n, 3);
  });

  test("contarHuerfanos: cuenta FILAS (varios alumnos en el mismo tramo huérfano cuentan todos)", () => {
    const filas = [{ hora_inicio: "16:15:00" }, { hora_inicio: "16:15:00" }, { hora_inicio: "16:15:00" }];
    const n = contarHuerfanos(filas, { franjaInicio: "15:30", franjaFin: "20:30", franjaDuracion: 60 });
    assert.equal(n, 3);
  });

  test("contarHuerfanos: sin filas -> 0", () => {
    assert.equal(contarHuerfanos([], { franjaInicio: "15:30", franjaFin: "20:30", franjaDuracion: 60 }), 0);
  });

  test("fetchImpactoHorario: consulta solo el tenant pedido Y solo vigente (mismo criterio que fetchFranjasVisibles)", async () => {
    const TENANT_ID = "tenant-1";
    const admin = makeFakeSupabaseAdmin({
      academia_horario: [
        { id: "h1", tenant_id: TENANT_ID, hora_inicio: "16:15:00", fecha_fin: null },
        { id: "h2", tenant_id: TENANT_ID, hora_inicio: "16:15:00", fecha_fin: "2026-01-01" },
        { id: "h3", tenant_id: "otro-tenant", hora_inicio: "16:15:00", fecha_fin: null },
      ],
    });
    const { huerfanos, error } = await fetchImpactoHorario(admin, TENANT_ID, {
      franjaInicio: "15:30", franjaFin: "20:30", franjaDuracion: 60,
    });
    assert.equal(error, undefined);
    assert.equal(huerfanos, 1, "cuenta solo h1 (vigente, mismo tenant) — ni h2 (cerrada) ni h3 (otro tenant)");
  });
}
