import { makeFakeSupabaseAdmin } from "../support/fakeSupabaseAdmin.mjs";

// LA LISTA DE "ENVÍO A FAMILIAS" MIRA LOS INFORMES EN SU MES, NO EN EL DEL
// RECIBO (Jorge, 30/09/2026: "el 5 de octubre, el recibo de octubre y el
// informe de septiembre"). Si el listado mirara octubre, Envío a familias
// diría que nadie tiene sesiones ni informe y la familia saldría pendiente
// para siempre, aunque el informe de septiembre ya se hubiera mandado.
export async function run({ test, assert }) {
  const { fetchListadoDelEnvio } = await import("../../server/lib/academiaEnvio/listadoDelEnvio.js");

  const mundo = (modo) => makeFakeSupabaseAdmin({
    academia_config: [{ tenant_id: "t1", modo_envio: modo }],
    academia_familias: [{ id: "f1", tenant_id: "t1", nombre: "Ruiz", email: "r@x.es", metodo_pago: "bizum", activa: true }],
    academia_alumnos: [{ id: "a1", tenant_id: "t1", nombre: "Eric", curso: "1.º ESO", familia_id: "f1", fecha_alta: "2026-09-01", activo: true }],
    academia_tarifas: [{ alumno_id: "a1", tenant_id: "t1", precio_bruto: 85, descuento_pct: 0, fecha_fin: null }],
    academia_recibos: [{ id: "r10", tenant_id: "t1", familia_id: "f1", mes: 10, anio: 2026, estado: "borrador", total_neto: 85 }],
    academia_sesiones: [{ id: "s1", tenant_id: "t1", alumno_id: "a1", tipo: "clase", fecha: "2026-09-16" }],
    academia_informes: [{ id: "i9", tenant_id: "t1", alumno_id: "a1", mes: 9, anio: 2026, comentario: "Bien", enviado_at: "2026-10-05T10:00:00Z" }],
    academia_envios_email: [],
  });

  test("modo informe del mes anterior: octubre lleva el recibo de octubre y mira sesiones e informe de septiembre", async () => {
    const { lista, periodoInforme, error } = await fetchListadoDelEnvio(mundo("informe_mes_anterior"), "t1", { mes: 10, anio: 2026 });
    assert.equal(error, undefined);
    assert.deepEqual(periodoInforme, { mes: 9, anio: 2026 });
    const [familia] = lista;
    assert.equal(familia.recibo.id, "r10");
    assert.equal(familia.alumnos_activos[0].tiene_sesiones, true);
    assert.equal(familia.alumnos_activos[0].informe_enviado_at, "2026-10-05T10:00:00Z");
  });

  test("modo mismo mes: octubre mira octubre (ni sesiones ni informe todavía)", async () => {
    const { lista, periodoInforme } = await fetchListadoDelEnvio(mundo("mismo_mes"), "t1", { mes: 10, anio: 2026 });
    assert.deepEqual(periodoInforme, { mes: 10, anio: 2026 });
    assert.equal(lista[0].alumnos_activos[0].tiene_sesiones, false);
    assert.equal(lista[0].alumnos_activos[0].informe_enviado_at, null);
  });
}
