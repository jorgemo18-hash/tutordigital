// REGRESIÓN: el descuento propio de la tarifa del alumno no llegaba al
// recibo. Se guardaba en academia_tarifas.descuento_pct y servía para
// calcular precio_neto —que es lo que muestra la lista de alumnos— pero
// generarRecibo leía solo precio_bruto. Tarifa de 100 € con 10%: la lista
// decía 90 €/mes y el recibo cobraba 100 €. Un campo de dinero que mentía.
//
// Ahora sale como línea de descuento propia, no rebajando el precio base:
// el PDF debe seguir diciendo "precio 100 €, descuento -10 €", no "precio
// 90 €", que sería afirmar un precio que no es el pactado.
import { makeFakeSupabaseAdmin } from "../support/fakeSupabaseAdmin.mjs";

const TENANT_ID = "t1";
const FAMILIA_ID = "f1";

export async function run({ test, assert }) {
  const { descuentoDeTarifa, CONCEPTO_DESCUENTO_TARIFA } = await import(
    "../../server/lib/academiaRecibos/calculos.js"
  );
  const { generarReciboParaFamilia } = await import("../../server/lib/academiaRecibos/generarRecibo.js");

  test("descuentoDeTarifa: 10% sobre 100 -> línea de 10 €", () => {
    assert.deepEqual(descuentoDeTarifa(100, 10), {
      concepto: CONCEPTO_DESCUENTO_TARIFA, porcentaje: 10, importe: 10,
    });
  });

  test("descuentoDeTarifa: 0, vacío o negativo -> ninguna línea", () => {
    for (const pct of [0, null, undefined, "", -5]) {
      assert.equal(descuentoDeTarifa(100, pct), null, `porcentaje: ${pct}`);
    }
  });

  test("descuentoDeTarifa: redondea a céntimos como el resto del dinero", () => {
    assert.equal(descuentoDeTarifa(33.33, 15).importe, 5);
  });

  function admin() {
    return makeFakeSupabaseAdmin({ academia_recibos: [], academia_recibos_lineas: [] });
  }
  const reciboDe = (a, id) => a._state.tables.academia_recibos.find((r) => r.id === id);
  const lineasDe = (a, id) => a._state.tables.academia_recibos_lineas.filter((l) => l.recibo_id === id);

  test("REGRESIÓN: el descuento de tarifa se cobra — bruto 100, neto 90", async () => {
    const a = admin();
    const { ok, reciboId } = await generarReciboParaFamilia(a, {
      tenantId: TENANT_ID, familiaId: FAMILIA_ID, mes: 9, anio: 2026, concepto: "Septiembre 2026",
      alumnosActivos: [{ id: "a1", nombre: "Ana", curso: "1º ESO", fecha_alta: "2026-09-01", precio_bruto: 100, descuento_tarifa_pct: 10 }],
      descuentosPorAlumno: {},
    });
    assert.equal(ok, true);
    const recibo = reciboDe(a, reciboId);
    assert.equal(recibo.total_bruto, 100, "el precio base NO se rebaja");
    assert.equal(recibo.total_descuento, 10);
    assert.equal(recibo.total_neto, 90);
  });

  test("aparece como línea nombrada en el desglose, para que el PDF lo muestre", async () => {
    const a = admin();
    const { reciboId } = await generarReciboParaFamilia(a, {
      tenantId: TENANT_ID, familiaId: FAMILIA_ID, mes: 9, anio: 2026, concepto: "Septiembre 2026",
      alumnosActivos: [{ id: "a1", nombre: "Ana", curso: "1º ESO", fecha_alta: "2026-09-01", precio_bruto: 100, descuento_tarifa_pct: 10 }],
      descuentosPorAlumno: {},
    });
    const [linea] = lineasDe(a, reciboId);
    assert.equal(linea.precio_bruto, 100, "la línea conserva el precio real");
    assert.deepEqual(linea.descuentos_recurrentes, [
      { concepto: CONCEPTO_DESCUENTO_TARIFA, porcentaje: 10, importe: 10 },
    ]);
  });

  test("se suma a los recurrentes, ambos sobre el bruto — nunca encadenados", async () => {
    const a = admin();
    const { reciboId } = await generarReciboParaFamilia(a, {
      tenantId: TENANT_ID, familiaId: FAMILIA_ID, mes: 9, anio: 2026, concepto: "Septiembre 2026",
      alumnosActivos: [{ id: "a1", nombre: "Ana", curso: "1º ESO", fecha_alta: "2026-09-01", precio_bruto: 100, descuento_tarifa_pct: 10 }],
      descuentosPorAlumno: { a1: [{ concepto: "Hermanos", porcentaje: 15, acumulable: true, intervalo: "siempre" }] },
    });
    const recibo = reciboDe(a, reciboId);
    // 10 + 15 sobre 100 = 25. Si se encadenaran sería 10 + 13,50 = 23,50.
    assert.equal(recibo.total_descuento, 25);
    assert.equal(recibo.total_neto, 75);
    assert.deepEqual(lineasDe(a, reciboId)[0].descuentos_recurrentes.map((d) => d.concepto),
      [CONCEPTO_DESCUENTO_TARIFA, "Hermanos"]);
  });

  test("un no acumulable del catálogo NO suprime el de tarifa (es el precio pactado)", async () => {
    const a = admin();
    const { reciboId } = await generarReciboParaFamilia(a, {
      tenantId: TENANT_ID, familiaId: FAMILIA_ID, mes: 9, anio: 2026, concepto: "Septiembre 2026",
      alumnosActivos: [{ id: "a1", nombre: "Ana", curso: "1º ESO", fecha_alta: "2026-09-01", precio_bruto: 100, descuento_tarifa_pct: 10 }],
      descuentosPorAlumno: { a1: [{ concepto: "Beca", porcentaje: 20, acumulable: false, intervalo: "siempre" }] },
    });
    assert.equal(reciboDe(a, reciboId).total_descuento, 30, "10 de tarifa + 20 de beca");
  });

  test("el descuento puntual del recibo sigue sumando encima de los dos", async () => {
    const a = admin();
    const { reciboId } = await generarReciboParaFamilia(a, {
      tenantId: TENANT_ID, familiaId: FAMILIA_ID, mes: 9, anio: 2026, concepto: "Septiembre 2026",
      alumnosActivos: [{ id: "a1", nombre: "Ana", curso: "1º ESO", fecha_alta: "2026-09-01", precio_bruto: 100, descuento_tarifa_pct: 10 }],
      descuentosPorAlumno: { a1: [{ concepto: "Hermanos", porcentaje: 15, acumulable: true, intervalo: "siempre" }] },
      descuentoPuntualPct: 5,
    });
    const recibo = reciboDe(a, reciboId);
    assert.equal(recibo.total_descuento, 30, "10 tarifa + 15 hermanos + 5 puntual");
    assert.equal(recibo.total_neto, 70);
  });

  test("sin descuento de tarifa el recibo no cambia respecto a antes", async () => {
    const a = admin();
    const { reciboId } = await generarReciboParaFamilia(a, {
      tenantId: TENANT_ID, familiaId: FAMILIA_ID, mes: 9, anio: 2026, concepto: "Septiembre 2026",
      alumnosActivos: [{ id: "a1", nombre: "Ana", curso: "1º ESO", fecha_alta: "2026-09-01", precio_bruto: 100 }],
      descuentosPorAlumno: {},
    });
    const recibo = reciboDe(a, reciboId);
    assert.equal(recibo.total_descuento, 0);
    assert.equal(recibo.total_neto, 100);
    assert.deepEqual(lineasDe(a, reciboId)[0].descuentos_recurrentes, []);
  });

  test("invariante: bruto = neto + descuento, también con hermanos", async () => {
    const a = admin();
    const { reciboId } = await generarReciboParaFamilia(a, {
      tenantId: TENANT_ID, familiaId: FAMILIA_ID, mes: 9, anio: 2026, concepto: "Septiembre 2026",
      alumnosActivos: [
        { id: "a1", nombre: "Ana", curso: "1º ESO", fecha_alta: "2026-09-01", precio_bruto: 120, descuento_tarifa_pct: 12.5 },
        { id: "a2", nombre: "Luis", curso: "3º ESO", fecha_alta: "2026-09-01", precio_bruto: 95, descuento_tarifa_pct: 7 },
      ],
      descuentosPorAlumno: {},
    });
    const r = reciboDe(a, reciboId);
    assert.equal(r.total_bruto, 215);
    assert.equal(Math.round((r.total_neto + r.total_descuento) * 100) / 100, r.total_bruto);
  });
}
