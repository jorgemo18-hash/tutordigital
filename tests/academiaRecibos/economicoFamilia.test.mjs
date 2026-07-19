import { makeFakeSupabaseAdmin } from "../support/fakeSupabaseAdmin.mjs";

// fetchEconomicoFamilia() debe dar exactamente lo mismo que produciría
// generarReciboParaFamilia() si se generase un recibo con estos datos hoy
// mismo — reutiliza las mismas funciones de calculos.js, así que estos
// tests son sobre todo de INTEGRACIÓN de la consulta (qué tabla toca, cómo
// arma el payload), no una reimplementación del cálculo en sí (eso ya está
// cubierto en desglosarDescuentosRecurrentes.test.mjs/calcularDescuento.test.mjs).
export async function run({ test, assert }) {
  const { fetchEconomicoFamilia } = await import("../../server/lib/academiaRecibos/economicoFamilia.js");

  test("familia con un acumulable activo -> subtotal y total cuadran con el cálculo real (caso ANIBAL_1E de Lyceo)", async () => {
    const admin = makeFakeSupabaseAdmin({
      academia_familias: [{ id: "f1", tenant_id: "t1", nombre: "Familia García" }],
      academia_alumnos: [
        { id: "a1", tenant_id: "t1", familia_id: "f1", nombre: "ANIBAL_1E", activo: true, fecha_alta: "2026-06-23" },
        { id: "a2", tenant_id: "t1", familia_id: "f1", nombre: "jose matias", activo: true, fecha_alta: "2026-06-25" },
      ],
      academia_tarifas: [
        { alumno_id: "a1", tenant_id: "t1", precio_bruto: 75, precio_neto: 67.5, fecha_fin: null },
        { alumno_id: "a2", tenant_id: "t1", precio_bruto: 45, precio_neto: 40.5, fecha_fin: null },
      ],
      academia_alumno_descuentos: [{
        id: "d1", alumno_id: "a1", descuento_tipo_id: "dt1", activo: true,
        descuento_tipo: { concepto: "primer mes", porcentaje: 20, acumulable: true, intervalo: "primer_mes", tenant_id: "t1" },
      }],
    });

    const { data } = await fetchEconomicoFamilia(admin, "t1", "f1", { hoy: new Date("2026-06-15") });

    assert.equal(data.alumnos.length, 2);
    const anibal = data.alumnos.find((a) => a.nombre === "ANIBAL_1E");
    assert.deepEqual(anibal.descuentos, [{ concepto: "primer mes", porcentaje: 20, importe: 15 }]);
    assert.equal(anibal.subtotalNeto, 60);
    assert.equal(data.totalBruto, 120);
    assert.equal(data.totalDescuento, 15);
    assert.equal(data.totalNeto, 105);
  });

  test("descuento 'primer mes' fuera de su mes de alta -> no aplica (mismo intervaloAplica que producción)", async () => {
    const admin = makeFakeSupabaseAdmin({
      academia_familias: [{ id: "f1", tenant_id: "t1", nombre: "Familia García" }],
      academia_alumnos: [{ id: "a1", tenant_id: "t1", familia_id: "f1", nombre: "ANIBAL_1E", activo: true, fecha_alta: "2026-06-23" }],
      academia_tarifas: [{ alumno_id: "a1", tenant_id: "t1", precio_bruto: 75, precio_neto: 75, fecha_fin: null }],
      academia_alumno_descuentos: [{ id: "d1", alumno_id: "a1", descuento_tipo_id: "dt1", activo: true }],
      academia_descuentos_tipo: [{ id: "dt1", tenant_id: "t1", concepto: "primer mes", porcentaje: 20, acumulable: true, intervalo: "primer_mes" }],
    });

    const { data } = await fetchEconomicoFamilia(admin, "t1", "f1", { hoy: new Date("2026-07-15") });
    assert.deepEqual(data.alumnos[0].descuentos, []);
    assert.equal(data.totalDescuento, 0);
    assert.equal(data.totalNeto, 75);
  });

  test("varios no-acumulables en empate -> solo el primero encontrado entra (mismo criterio documentado que desglosarDescuentosRecurrentes)", async () => {
    const admin = makeFakeSupabaseAdmin({
      academia_familias: [{ id: "f1", tenant_id: "t1", nombre: "F" }],
      academia_alumnos: [{ id: "a1", tenant_id: "t1", familia_id: "f1", nombre: "X", activo: true, fecha_alta: "2026-01-01" }],
      academia_tarifas: [{ alumno_id: "a1", tenant_id: "t1", precio_bruto: 100, precio_neto: 100, fecha_fin: null }],
      academia_alumno_descuentos: [
        {
          id: "d1", alumno_id: "a1", descuento_tipo_id: "dt1", activo: true,
          descuento_tipo: { concepto: "Promo A", porcentaje: 15, acumulable: false, intervalo: "siempre", tenant_id: "t1" },
        },
        {
          id: "d2", alumno_id: "a1", descuento_tipo_id: "dt2", activo: true,
          descuento_tipo: { concepto: "Promo B", porcentaje: 15, acumulable: false, intervalo: "siempre", tenant_id: "t1" },
        },
      ],
    });

    const { data } = await fetchEconomicoFamilia(admin, "t1", "f1", { hoy: new Date("2026-06-01") });
    assert.equal(data.alumnos[0].descuentos.length, 1);
    assert.equal(data.totalDescuento, 15);
  });

  test("alumno sin tarifa vigente -> bruto 0, no revienta", async () => {
    const admin = makeFakeSupabaseAdmin({
      academia_familias: [{ id: "f1", tenant_id: "t1", nombre: "F" }],
      academia_alumnos: [{ id: "a1", tenant_id: "t1", familia_id: "f1", nombre: "Sin Tarifa", activo: true, fecha_alta: "2026-01-01" }],
      academia_tarifas: [],
      academia_alumno_descuentos: [],
      academia_descuentos_tipo: [],
    });

    const { data } = await fetchEconomicoFamilia(admin, "t1", "f1", { hoy: new Date("2026-06-01") });
    assert.equal(data.alumnos[0].tarifa, null);
    assert.equal(data.alumnos[0].subtotalNeto, 0);
    assert.equal(data.totalNeto, 0);
  });

  test("alumno archivado de la familia no cuenta ni en la lista ni en el total (foto de HOY, no histórica)", async () => {
    const admin = makeFakeSupabaseAdmin({
      academia_familias: [{ id: "f1", tenant_id: "t1", nombre: "F" }],
      academia_alumnos: [
        { id: "a1", tenant_id: "t1", familia_id: "f1", nombre: "Activo", activo: true, fecha_alta: "2026-01-01" },
        { id: "a2", tenant_id: "t1", familia_id: "f1", nombre: "Archivado", activo: false, fecha_alta: "2026-01-01" },
      ],
      academia_tarifas: [
        { alumno_id: "a1", tenant_id: "t1", precio_bruto: 50, precio_neto: 50, fecha_fin: null },
        { alumno_id: "a2", tenant_id: "t1", precio_bruto: 90, precio_neto: 90, fecha_fin: null },
      ],
      academia_alumno_descuentos: [],
      academia_descuentos_tipo: [],
    });

    const { data } = await fetchEconomicoFamilia(admin, "t1", "f1", { hoy: new Date("2026-06-01") });
    assert.equal(data.alumnos.length, 1);
    assert.equal(data.alumnos[0].nombre, "Activo");
    assert.equal(data.totalBruto, 50);
  });

  test("familia de otro tenant -> data null (nunca se filtra solo por id)", async () => {
    const admin = makeFakeSupabaseAdmin({
      academia_familias: [{ id: "f1", tenant_id: "otro-tenant", nombre: "F ajena" }],
      academia_alumnos: [],
      academia_tarifas: [],
      academia_alumno_descuentos: [],
      academia_descuentos_tipo: [],
    });

    const { data } = await fetchEconomicoFamilia(admin, "t1", "f1", { hoy: new Date("2026-06-01") });
    assert.equal(data, null);
  });

  test("familia sin alumnos activos -> listas vacías, totales en 0", async () => {
    const admin = makeFakeSupabaseAdmin({
      academia_familias: [{ id: "f1", tenant_id: "t1", nombre: "F" }],
      academia_alumnos: [],
      academia_tarifas: [],
      academia_alumno_descuentos: [],
      academia_descuentos_tipo: [],
    });

    const { data } = await fetchEconomicoFamilia(admin, "t1", "f1", { hoy: new Date("2026-06-01") });
    assert.deepEqual(data.alumnos, []);
    assert.equal(data.totalNeto, 0);
  });
}
