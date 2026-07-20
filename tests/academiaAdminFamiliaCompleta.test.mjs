import { Window } from "happy-dom";
import { makeFakeSupabaseAdmin } from "./support/fakeSupabaseAdmin.mjs";

// Entorno DOM (happy-dom), mismo patrón que alumnosList.test.mjs.
const window = new Window();
globalThis.window = window;
globalThis.document = window.document;

function esperar(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// El bloque ya no pide la lista de alumnos y calcula por su cuenta — pide
// la foto económica YA CALCULADA por el backend (fetchEconomicoFamilia,
// que reutiliza intervaloAplica/desglosarDescuentosRecurrentes/
// calcularDescuento/round2, ver economicoFamilia.js). Aquí se conecta esa
// función REAL contra un fake de Supabase — no un mock con números escritos
// a mano — para que estos tests demuestren que el bloque pinta EXACTAMENTE
// lo que produce el motor real, no una aproximación.
// api.js#fetchEconomicoFamilia (la real, llamada por el bloque) devuelve el
// payload YA DESENVUELTO de {data,error} — mismo desenvolvimiento que hace
// callJson() en el navegador — así que aquí se replica exactamente ese
// desenvolvimiento sobre la función de servidor real.
function fetchEconomicoFnReal(fetchEconomicoFamilia, admin, tenantId, hoy) {
  return async (familiaId) => {
    const { data, error } = await fetchEconomicoFamilia(admin, tenantId, familiaId, { hoy });
    if (error) throw new Error(error.message || "fetch failed");
    return data;
  };
}

export async function run({ test, assert }) {
  const { buildFamiliaCompletaBlock } = await import("../assets/academia/admin/js/drawer/familia/familiaCompleta.js");
  const { fetchEconomicoFamilia } = await import("../server/lib/academiaRecibos/economicoFamilia.js");
  const { desglosarDescuentosRecurrentes, calcularDescuento } = await import("../server/lib/academiaRecibos/calculos.js");

  const TENANT_ID = "t1";
  const HOY = new Date("2026-06-15");

  test("un alumno con descuento 'siempre' activo y otro sin descuentos: líneas y subtotales coinciden exactamente con desglosarDescuentosRecurrentes/calcularDescuento", async () => {
    const admin = makeFakeSupabaseAdmin({
      academia_familias: [{ id: "f1", tenant_id: TENANT_ID, nombre: "F" }],
      academia_alumnos: [
        { id: "a1", tenant_id: TENANT_ID, familia_id: "f1", nombre: "Con Hermanos", activo: true, fecha_alta: "2026-01-01" },
        { id: "a2", tenant_id: TENANT_ID, familia_id: "f1", nombre: "Sin Descuento", activo: true, fecha_alta: "2026-01-01" },
      ],
      academia_tarifas: [
        { alumno_id: "a1", tenant_id: TENANT_ID, precio_bruto: 100, precio_neto: 100, fecha_fin: null },
        { alumno_id: "a2", tenant_id: TENANT_ID, precio_bruto: 50, precio_neto: 50, fecha_fin: null },
      ],
      academia_alumno_descuentos: [{
        id: "d1", alumno_id: "a1", activo: true,
        descuento_tipo: { concepto: "Hermanos", porcentaje: 15, acumulable: true, intervalo: "siempre", tenant_id: TENANT_ID },
      }],
    });

    // Oráculo independiente: mismo cálculo, llamado directo a las funciones
    // reales — no números tecleados a mano.
    const desgloseEsperado = desglosarDescuentosRecurrentes([{ concepto: "Hermanos", porcentaje: 15, acumulable: true }], 100);
    const { totalNeto: totalEsperado } = calcularDescuento({
      totalBruto: 150,
      descuentoRecurrenteImporte: desgloseEsperado.reduce((s, d) => s + d.importe, 0),
    });

    const { wrap } = buildFamiliaCompletaBlock({
      familiaId: "f1",
      alumnoId: "a1", // editando a "Con Hermanos", ya es miembro
      fetchEconomicoFn: fetchEconomicoFnReal(fetchEconomicoFamilia, admin, TENANT_ID, HOY),
    });
    await esperar(20);

    const filas = wrap.querySelectorAll(".ac-econ-fila");
    assert.equal(filas.length, 2, "cada alumno una sola vez, sin fila extra (ya es miembro)");

    const filaConHermanos = [...filas].find((f) => f.textContent.includes("Con Hermanos"));
    const lineasDescuento = filaConHermanos.querySelectorAll(".ac-econ-descuento");
    assert.equal(lineasDescuento.length, desgloseEsperado.length);
    assert.ok(lineasDescuento[0].textContent.includes("Hermanos (-15.00%)"));
    assert.ok(lineasDescuento[0].textContent.includes(`-${desgloseEsperado[0].importe.toFixed(2)} €`));
    assert.ok(filaConHermanos.querySelector(".ac-econ-subtotal").textContent.includes("85.00 €"));

    const filaSinDescuento = [...filas].find((f) => f.textContent.includes("Sin Descuento"));
    assert.equal(filaSinDescuento.querySelectorAll(".ac-econ-descuento").length, 0, "sin descuentos activos -> sin líneas de descuento");
    assert.ok(filaSinDescuento.querySelector(".ac-econ-subtotal").textContent.includes("50.00 €"), "subtotal = tarifa bruta, sin descontar nada");

    const total = wrap.querySelector(".ac-familia-completa-total span:last-child").textContent;
    assert.equal(total, `${totalEsperado.toFixed(2)} €`);
    assert.equal(total, "135.00 €");
  });

  test("descuento 'primer mes' activo este mes (mes de alta) -> aparece la línea, respetando intervaloAplica", async () => {
    const admin = makeFakeSupabaseAdmin({
      academia_familias: [{ id: "f2", tenant_id: TENANT_ID, nombre: "F" }],
      academia_alumnos: [{ id: "a3", tenant_id: TENANT_ID, familia_id: "f2", nombre: "Recién Llegado", activo: true, fecha_alta: "2026-06-10" }],
      academia_tarifas: [{ alumno_id: "a3", tenant_id: TENANT_ID, precio_bruto: 80, precio_neto: 80, fecha_fin: null }],
      academia_alumno_descuentos: [{
        id: "d2", alumno_id: "a3", activo: true,
        descuento_tipo: { concepto: "primer mes", porcentaje: 20, acumulable: true, intervalo: "primer_mes", tenant_id: TENANT_ID },
      }],
    });

    const { wrap } = buildFamiliaCompletaBlock({
      familiaId: "f2",
      alumnoId: "a3",
      fetchEconomicoFn: fetchEconomicoFnReal(fetchEconomicoFamilia, admin, TENANT_ID, HOY), // HOY = junio 2026, mismo mes que fecha_alta
    });
    await esperar(20);

    const fila = wrap.querySelector(".ac-econ-fila");
    const lineas = fila.querySelectorAll(".ac-econ-descuento");
    assert.equal(lineas.length, 1);
    assert.ok(lineas[0].textContent.includes("primer mes (-20.00%)"));
    assert.ok(fila.querySelector(".ac-econ-subtotal").textContent.includes("64.00 €")); // 80 - 16
  });

  test("descuento 'primer mes' ya vencido (mes de alta pasado) -> NO aparece la línea, subtotal = tarifa completa", async () => {
    const admin = makeFakeSupabaseAdmin({
      academia_familias: [{ id: "f3", tenant_id: TENANT_ID, nombre: "F" }],
      academia_alumnos: [{ id: "a4", tenant_id: TENANT_ID, familia_id: "f3", nombre: "Alta Antigua", activo: true, fecha_alta: "2026-01-05" }],
      academia_tarifas: [{ alumno_id: "a4", tenant_id: TENANT_ID, precio_bruto: 80, precio_neto: 80, fecha_fin: null }],
      academia_alumno_descuentos: [{
        id: "d3", alumno_id: "a4", activo: true,
        descuento_tipo: { concepto: "primer mes", porcentaje: 20, acumulable: true, intervalo: "primer_mes", tenant_id: TENANT_ID },
      }],
    });

    const { wrap } = buildFamiliaCompletaBlock({
      familiaId: "f3",
      alumnoId: "a4",
      fetchEconomicoFn: fetchEconomicoFnReal(fetchEconomicoFamilia, admin, TENANT_ID, HOY), // HOY = junio, alta fue en enero
    });
    await esperar(20);

    const fila = wrap.querySelector(".ac-econ-fila");
    assert.equal(fila.querySelectorAll(".ac-econ-descuento").length, 0, "el mes de 'primer mes' ya pasó — no debe mostrarse");
    assert.ok(fila.querySelector(".ac-econ-subtotal").textContent.includes("80.00 €"));
  });

  test("crear un alumno nuevo (sin id todavía): su fila no lleva líneas de descuento — no hay alumno_id que consultar en el motor real", async () => {
    const admin = makeFakeSupabaseAdmin({
      academia_familias: [{ id: "f4", tenant_id: TENANT_ID, nombre: "F" }],
      academia_alumnos: [{ id: "a5", tenant_id: TENANT_ID, familia_id: "f4", nombre: "Hermano Existente", activo: true, fecha_alta: "2026-01-01" }],
      academia_tarifas: [{ alumno_id: "a5", tenant_id: TENANT_ID, precio_bruto: 60, precio_neto: 60, fecha_fin: null }],
      academia_alumno_descuentos: [],
    });

    const { wrap } = buildFamiliaCompletaBlock({
      familiaId: "f4",
      alumnoId: null,
      fetchEconomicoFn: fetchEconomicoFnReal(fetchEconomicoFamilia, admin, TENANT_ID, HOY),
      getTarifaActual: () => ({ precio_bruto: 40, descuento_pct: 0 }),
      getNombreActual: () => "Luis Nuevo",
    });
    await esperar(20);

    const filas = wrap.querySelectorAll(".ac-econ-fila");
    assert.equal(filas.length, 2, "Hermano Existente + Luis Nuevo (todavía sin guardar)");
    const filaNueva = [...filas].find((f) => f.textContent.includes("Luis Nuevo"));
    assert.equal(filaNueva.querySelectorAll(".ac-econ-descuento").length, 0);
    assert.ok(filaNueva.querySelector(".ac-econ-subtotal").textContent.includes("40.00 €"));

    const total = wrap.querySelector(".ac-familia-completa-total span:last-child").textContent;
    assert.equal(total, "100.00 €"); // 60 (Hermano Existente) + 40 (Luis Nuevo)
  });
}
