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
  // BAJAS A FINAL DE MES (30/09/2026): quien se va al acabar septiembre sigue
  // teniendo su informe de septiembre en el envío de octubre, pero no recibo.
  test("un alumno de baja desde el mes del informe sale en el informe, no en el recibo", async () => {
    const admin = mundo("informe_mes_anterior");
    const t = admin._state.tables;
    t.academia_alumnos.push(
      { id: "a2", tenant_id: "t1", nombre: "Nora", curso: "3.º ESO", familia_id: "f1", fecha_alta: "2025-09-01", activo: false, fecha_baja: "2026-10-02" },
      { id: "a3", tenant_id: "t1", nombre: "Vieja", curso: "4.º ESO", familia_id: "f1", fecha_alta: "2024-09-01", activo: false, fecha_baja: "2026-08-20" },
      { id: "a4", tenant_id: "t1", nombre: "Pendiente", curso: "1.º ESO", familia_id: "f1", fecha_alta: "2026-09-01", activo: false, fecha_baja: null },
      // Archivada en septiembre sin una sola clase (una limpieza de fichas):
      // no tiene informe que recibir.
      { id: "a5", tenant_id: "t1", nombre: "Sin clases", curso: "2.º ESO", familia_id: "f1", fecha_alta: "2026-09-01", activo: false, fecha_baja: "2026-09-16" },
    );
    t.academia_sesiones.push({ id: "s2", tenant_id: "t1", alumno_id: "a2", tipo: "clase", fecha: "2026-09-20" });
    const { lista } = await fetchListadoDelEnvio(admin, "t1", { mes: 10, anio: 2026 });
    const [familia] = lista;
    assert.deepEqual(familia.alumnos_activos.map((a) => a.nombre), ["Eric"]);
    assert.deepEqual(familia.alumnos_informe.map((a) => a.nombre), ["Eric", "Nora"]);
    const nora = familia.alumnos_informe.find((a) => a.nombre === "Nora");
    assert.equal(nora.de_baja, true);
    assert.equal(nora.tiene_sesiones, true);
  });
}
