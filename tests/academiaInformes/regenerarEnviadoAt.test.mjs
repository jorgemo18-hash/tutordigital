import { makeFakeSupabaseAdmin } from "../support/fakeSupabaseAdmin.mjs";

// generarYGuardarComentario(forzar:true) sobre un informe ya enviado debe
// dejarlo en enviado_at:null (política forward-only: la nueva versión aún
// no se ha mandado a la familia). El upsert real usa
// onConflict:"tenant_id,alumno_id,anio,mes" (clave compuesta) — el fake
// compartido (tests/support/fakeSupabaseAdmin.mjs) solo sabe emparejar por
// una única columna, así que aquí se sustituye "academia_informes" por un
// stub local mínimo que sí aplica un UPDATE de las columnas del payload
// sobre la fila existente (mismo comportamiento que Postgres ON CONFLICT
// DO UPDATE SET <columnas listadas>: lo que no viaja en el payload no se
// toca) — mismo criterio que siguienteNumeroRecibo.test.mjs para
// count/head. Se fuerza el camino "sin actividad" (sin sesiones/festivos)
// para no depender de Claude, igual que enviarInforme.test.mjs.

function makeTablaInformesConUpsertCompuesto(seed) {
  let fila = seed ? { id: "inf1", ...seed } : null;
  return {
    upsert(payload) {
      if (fila) Object.assign(fila, payload);
      else fila = { id: "inf1", ...payload };
      return {
        select: () => ({
          single: () => Promise.resolve({ data: { id: fila.id, enviado_at: fila.enviado_at ?? null }, error: null }),
        }),
      };
    },
  };
}

export async function run({ test, assert }) {
  const { generarYGuardarComentario } = await import("../../server/lib/academiaInformes/generarInforme.js");

  const TENANT_ID = "t1";
  const ALUMNO_ID = "a1";

  function fakeAdmin(enviadoAtSeed) {
    const base = makeFakeSupabaseAdmin({
      academia_alumnos: [{ id: ALUMNO_ID, tenant_id: TENANT_ID, nombre: "Ana García", curso: "1º ESO", familia_id: "f1", familia: { email: "familia@example.com" } }],
      academia_sesiones: [],
      academia_festivos: [],
    });
    const informesTable = makeTablaInformesConUpsertCompuesto(
      enviadoAtSeed !== undefined ? { tenant_id: TENANT_ID, alumno_id: ALUMNO_ID, mes: 7, anio: 2026, comentario: "viejo", enviado_at: enviadoAtSeed } : null
    );
    return { from: (table) => (table === "academia_informes" ? informesTable : base.from(table)) };
  }

  test("regenerar (forzar:true) un informe ya enviado lo deja en enviado_at:null", async () => {
    const admin = fakeAdmin("2026-07-01T10:00:00.000Z");
    const resultado = await generarYGuardarComentario(admin, {
      tenantId: TENANT_ID, alumnoId: ALUMNO_ID, mes: 7, anio: 2026, apiKey: "no-se-usa-sin-sesiones", forzar: true,
    });
    assert.equal(resultado.ok, true, resultado.motivo);
    assert.equal(resultado.enviadoAt, null);
  });

  test("sin forzar, un informe ya enviado no se toca (enviado_at se mantiene)", async () => {
    const admin = fakeAdmin("2026-07-01T10:00:00.000Z");
    const resultado = await generarYGuardarComentario(admin, {
      tenantId: TENANT_ID, alumnoId: ALUMNO_ID, mes: 7, anio: 2026, apiKey: "no-se-usa-sin-sesiones", forzar: false,
    });
    assert.equal(resultado.ok, true, resultado.motivo);
    assert.equal(resultado.enviadoAt, "2026-07-01T10:00:00.000Z");
  });

  test("un informe nunca enviado (enviado_at null) al regenerar sigue en null — no-op, no revienta", async () => {
    const admin = fakeAdmin(null);
    const resultado = await generarYGuardarComentario(admin, {
      tenantId: TENANT_ID, alumnoId: ALUMNO_ID, mes: 7, anio: 2026, apiKey: "no-se-usa-sin-sesiones", forzar: true,
    });
    assert.equal(resultado.ok, true, resultado.motivo);
    assert.equal(resultado.enviadoAt, null);
  });
}
