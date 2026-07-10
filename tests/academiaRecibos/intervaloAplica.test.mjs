// intervaloAplica() — decide si un descuento recurrente con un intervalo
// dado (siempre / primer_mes / primer_trimestre) aplica al período (mes,
// año) del recibo, según la fecha_alta del alumno. Un bug aquí no pierde
// céntimos directamente, pero decide QUÉ descuentos entran en el cálculo
// — un falso positivo/negativo sí cambia el importe final del recibo.

export async function run({ test, assert }) {
  const { intervaloAplica } = await import("../../server/lib/academiaRecibos/calculos.js");

  // ── "siempre" ─────────────────────────────────────────────────────────

  test("siempre: aplica siempre, con o sin fecha_alta", () => {
    assert.strictEqual(intervaloAplica("siempre", { fechaAlta: "2020-01-01", mes: 6, anio: 2026 }), true);
    assert.strictEqual(intervaloAplica("siempre", { fechaAlta: null, mes: 6, anio: 2026 }), true);
    assert.strictEqual(intervaloAplica("siempre", {}), true);
  });

  // ── "primer_mes" ──────────────────────────────────────────────────────

  test("primer_mes: aplica solo en el mes y año exactos de la fecha_alta", () => {
    assert.strictEqual(intervaloAplica("primer_mes", { fechaAlta: "2026-03-10", mes: 3, anio: 2026 }), true);
    assert.strictEqual(intervaloAplica("primer_mes", { fechaAlta: "2026-03-10", mes: 4, anio: 2026 }), false);
    assert.strictEqual(intervaloAplica("primer_mes", { fechaAlta: "2026-03-10", mes: 3, anio: 2027 }), false);
  });

  test("primer_mes: sin fecha_alta nunca aplica", () => {
    assert.strictEqual(intervaloAplica("primer_mes", { fechaAlta: null, mes: 3, anio: 2026 }), false);
    assert.strictEqual(intervaloAplica("primer_mes", { mes: 3, anio: 2026 }), false);
  });

  // ── "primer_trimestre" — límites 0/1/2/3 meses desde alta ────────────────

  test("primer_trimestre: aplica en los 3 primeros meses (0, 1 y 2 meses desde alta), no en el 4º", () => {
    const fechaAlta = "2026-01-15";
    assert.strictEqual(intervaloAplica("primer_trimestre", { fechaAlta, mes: 1, anio: 2026 }), true);  // mes 0
    assert.strictEqual(intervaloAplica("primer_trimestre", { fechaAlta, mes: 2, anio: 2026 }), true);  // mes 1
    assert.strictEqual(intervaloAplica("primer_trimestre", { fechaAlta, mes: 3, anio: 2026 }), true);  // mes 2 (límite superior)
    assert.strictEqual(intervaloAplica("primer_trimestre", { fechaAlta, mes: 4, anio: 2026 }), false); // mes 3, ya fuera
  });

  test("primer_trimestre: no aplica antes de la fecha_alta (meses negativos)", () => {
    assert.strictEqual(intervaloAplica("primer_trimestre", { fechaAlta: "2026-03-01", mes: 2, anio: 2026 }), false);
    assert.strictEqual(intervaloAplica("primer_trimestre", { fechaAlta: "2026-03-01", mes: 1, anio: 2026 }), false);
  });

  test("primer_trimestre: cruce de año — alta en noviembre cubre nov/dic/enero", () => {
    const fechaAlta = "2025-11-01";
    assert.strictEqual(intervaloAplica("primer_trimestre", { fechaAlta, mes: 11, anio: 2025 }), true);  // mes 0
    assert.strictEqual(intervaloAplica("primer_trimestre", { fechaAlta, mes: 12, anio: 2025 }), true);  // mes 1
    assert.strictEqual(intervaloAplica("primer_trimestre", { fechaAlta, mes: 1,  anio: 2026 }), true);  // mes 2
    assert.strictEqual(intervaloAplica("primer_trimestre", { fechaAlta, mes: 2,  anio: 2026 }), false); // mes 3
  });

  test("primer_trimestre: sin fecha_alta nunca aplica", () => {
    assert.strictEqual(intervaloAplica("primer_trimestre", { fechaAlta: null, mes: 1, anio: 2026 }), false);
  });

  // ── intervalo desconocido ─────────────────────────────────────────────

  test("intervalo desconocido: no aplica (fail closed, no fail open)", () => {
    assert.strictEqual(intervaloAplica("otra-cosa", { fechaAlta: "2026-01-01", mes: 1, anio: 2026 }), false);
    assert.strictEqual(intervaloAplica(undefined, { fechaAlta: "2026-01-01", mes: 1, anio: 2026 }), false);
  });
}
