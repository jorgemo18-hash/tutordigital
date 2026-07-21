import { Window } from "happy-dom";

// Entorno DOM (happy-dom), mismo patrón que academiaAdminDescuentosRecurrentesSection.test.mjs.
const window = new Window();
globalThis.window = window;
globalThis.document = window.document;

function reciboBase(overrides = {}) {
  return {
    mes: 7,
    anio: 2026,
    concepto: "Julio 2026",
    numero_recibo: "REC-2026-001",
    created_at: "2026-07-01T00:00:00.000Z",
    estado: "borrador",
    fecha_envio: null,
    familia: { nombre: "García", metodo_pago: "transferencia" },
    descuento_hermanos_pct: 0,
    ...overrides,
  };
}

export async function run({ test, assert }) {
  const { buildReciboPreview } = await import("../assets/academia/admin/js/sections/envioFamilias/reciboPreview.js");

  test("el descuento puntual (2+ alumnos) NO es una fila de la tabla de alumnos — aparece como bloque de familia aparte", () => {
    const recibo = reciboBase({
      lineas: [
        { nombre_alumno: "Ana", descripcion: "Julio 2026", precio_bruto: 100, descuentos_recurrentes: [] },
        { nombre_alumno: "Luis", descripcion: "Julio 2026", precio_bruto: 100, descuentos_recurrentes: [] },
      ],
      descuento_puntual_pct: 10,
      descuento_puntual_nota: "Beca ayuntamiento",
      total_bruto: 200,
      total_descuento: 20,
      total_neto: 180,
    });

    const wrap = buildReciboPreview(recibo, {});

    const filas = [...wrap.querySelectorAll("tbody tr")];
    assert.equal(filas.length, 2, "solo una fila por alumno — el puntual no debe añadir una fila a la tabla");
    for (const fila of filas) {
      assert.equal(fila.textContent.includes("Descuento familia"), false, "ninguna fila de alumno debe mencionar el descuento de familia");
    }

    assert.equal(wrap.textContent.includes("Descuento familia — Beca ayuntamiento"), true, "el bloque de familia debe mostrar la nota del descuento");
    assert.equal(wrap.textContent.includes("-20.00"), true, "el importe del descuento puntual debe verse (10% de 200)");
  });

  test("con un solo alumno, el bloque Subtotal/Descuentos se omite (redundante) pero el descuento puntual se sigue viendo", () => {
    const recibo = reciboBase({
      lineas: [{ nombre_alumno: "Ana", descripcion: "Julio 2026", precio_bruto: 100, descuentos_recurrentes: [] }],
      descuento_puntual_pct: 10,
      descuento_puntual_nota: null,
      total_bruto: 100,
      total_descuento: 10,
      total_neto: 90,
    });

    const wrap = buildReciboPreview(recibo, {});

    assert.equal(wrap.textContent.includes("Subtotal"), false, "con 1 alumno, Subtotal/Descuentos se omite por redundante");
    assert.equal(wrap.textContent.includes("Descuento familia"), true, "el puntual nunca es redundante — no vive en la fila del alumno");
    assert.equal(wrap.textContent.includes("-10.00"), true);
  });

  test("sin descuento puntual (pct=0), no aparece ningún bloque 'Descuento familia'", () => {
    const recibo = reciboBase({
      lineas: [
        { nombre_alumno: "Ana", descripcion: "Julio 2026", precio_bruto: 100, descuentos_recurrentes: [] },
        { nombre_alumno: "Luis", descripcion: "Julio 2026", precio_bruto: 100, descuentos_recurrentes: [] },
      ],
      descuento_puntual_pct: 0,
      descuento_puntual_nota: null,
      total_bruto: 200,
      total_descuento: 0,
      total_neto: 200,
    });

    const wrap = buildReciboPreview(recibo, {});
    assert.equal(wrap.textContent.includes("Descuento familia"), false);
  });
}
