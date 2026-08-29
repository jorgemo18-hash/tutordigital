import { makeFakeSupabaseAdmin } from "../support/fakeSupabaseAdmin.mjs";

export async function run({ test, assert }) {
  const { contarHuerfanos, fetchImpactoHorario } = await import("../../server/lib/academiaConfig/horarioImpacto.js");

  test("contarHuerfanos: config sin cambios (Lyceo real) -> 0 huérfanos entre sus 5 hora_inicio distintas", () => {
    const filas = [
      { hora_inicio: "15:30:00", hora_fin: "16:30:00" }, { hora_inicio: "16:30:00", hora_fin: "17:30:00" },
      { hora_inicio: "17:30:00", hora_fin: "18:30:00" }, { hora_inicio: "18:30:00", hora_fin: "19:30:00" },
      { hora_inicio: "19:30:00", hora_fin: "20:30:00" },
    ];
    const n = contarHuerfanos(filas, { franjaInicio: "15:30", franjaFin: "20:30", franjaDuracion: 60 });
    assert.equal(n, 0);
  });

  test("REGRESIÓN: cambiar la duración estándar ya NO deja huérfano a nadie", () => {
    // Antes la duración dibujaba las filas de la rejilla, así que tocarla
    // descolocaba todas las clases. Ahora solo dice cuántas casillas marca
    // un clic (ver horarioTramos.js): no mueve ninguna clase existente, y
    // avisar de 47 huérfanos por cambiarla era asustar sin motivo.
    const filas = [
      { hora_inicio: "15:30:00", hora_fin: "16:30:00" },
      { hora_inicio: "16:30:00", hora_fin: "17:30:00" },
      { hora_inicio: "19:30:00", hora_fin: "20:30:00" },
    ];
    assert.equal(contarHuerfanos(filas, { franjaInicio: "15:30", franjaFin: "20:30", franjaDuracion: 90 }), 0);
  });

  test("adelantar el cierre deja huérfana a la clase que se sale, aunque EMPIECE dentro", () => {
    // El caso que se escapaba mirando solo la hora de inicio: una clase de
    // 18:30 a 19:30 empieza dentro de un cierre a las 19:00, pero media
    // clase se queda fuera de la rejilla — y lo que no está en la rejilla
    // el admin no lo puede ni ver ni tocar.
    const filas = [
      { hora_inicio: "17:00:00", hora_fin: "18:00:00" },
      { hora_inicio: "18:30:00", hora_fin: "19:30:00" },
    ];
    assert.equal(contarHuerfanos(filas, { franjaInicio: "15:30", franjaFin: "19:00" }), 1);
  });

  test("una media hora suelta fuera del horario también cuenta", () => {
    const filas = [{ hora_inicio: "15:00:00", hora_fin: "15:30:00" }];
    assert.equal(contarHuerfanos(filas, { franjaInicio: "15:30", franjaFin: "20:30" }), 1);
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
