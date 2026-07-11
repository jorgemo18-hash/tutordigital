// round2() — único punto de redondeo a céntimos de calculos.js (antes
// triplicado inline como Math.round(x*100)/100 en 3 sitios de este archivo
// + una 4ª copia en generarRecibo.js, ahora consolidados aquí).
//
// CORREGIDO 2026-07-11: la versión anterior (Math.round(x*100)/100) no era
// un half-up fiable — heredaba el error de representación binaria de
// `value * 100` (round2(1.005) daba 1, no 1.01). La versión actual extrae
// los céntimos como enteros desde un string de alta precisión, sin volver
// a multiplicar en coma flotante — ver el comentario en calculos.js para el
// porqué del enfoque y por qué el truco obvio (Number(x.toFixed(10))*100)
// NO basta. Efecto solo hacia adelante: los recibos ya emitidos con la
// versión anterior no se regeneran.

export async function run({ test, assert }) {
  const { round2 } = await import("../../server/lib/academiaRecibos/calculos.js");

  // ── casos normales ────────────────────────────────────────────────────

  test("round2: redondea hacia arriba a partir de .xx5 en el caso normal", () => {
    assert.strictEqual(round2(2.675), 2.68);
    assert.strictEqual(round2(33.335), 33.34);
    assert.strictEqual(round2(10.005), 10.01);
  });

  test("round2: no toca valores ya exactos a 2 decimales", () => {
    assert.strictEqual(round2(10), 10);
    assert.strictEqual(round2(10.5), 10.5);
    assert.strictEqual(round2(10.25), 10.25);
    assert.strictEqual(round2(0.01), 0.01);
  });

  test("round2: trunca/redondea el 3er decimal hacia abajo cuando no llega a .5", () => {
    assert.strictEqual(round2(10.001), 10);
    assert.strictEqual(round2(10.004), 10);
    assert.strictEqual(round2(10.006), 10.01);
  });

  // ── tercios (fuerzan decimales periódicos) ───────────────────────────────

  test("round2: tercios de cantidades — 100/3 y 200/3", () => {
    assert.strictEqual(round2(100 / 3), 33.33);
    assert.strictEqual(round2(200 / 3), 66.67);
    assert.strictEqual(round2(10 / 3), 3.33);
  });

  // ── límites: cero, negativos, no-numéricos ───────────────────────────────

  test("round2: cero", () => {
    assert.strictEqual(round2(0), 0);
    assert.strictEqual(round2(-0), 0);
  });

  test("round2: negativos — half-up simétrico (redondea por magnitud, no hacia +Infinity)", () => {
    assert.strictEqual(round2(-10.001), -10);
    assert.strictEqual(round2(-10.006), -10.01);
    // A diferencia de Math.round(-2.5) === -2 (JS redondea el .5 negativo
    // hacia +Infinity, no "hacia fuera"), round2 es simétrico: -0.005 sube
    // en magnitud igual que 0.005, dando -0.01.
    assert.strictEqual(round2(-0.005), -0.01);
    assert.strictEqual(round2(-1.005), -1.01);
  });

  test("round2: NaN/undefined/null se tratan como 0 (mismo criterio que el resto del archivo, Number(x) || 0)", () => {
    assert.strictEqual(round2(NaN), 0);
    assert.strictEqual(round2(undefined), 0);
    assert.strictEqual(round2(null), 0);
    assert.strictEqual(round2("no-es-numero"), 0);
  });

  // ── regresión: casos que fallaban con Math.round(x*100)/100 ──────────────
  // Clavados aquí para que una futura "simplificación" que vuelva al patrón
  // ingenuo no pase desapercibida. Los valores de la derecha son el
  // half-up matemáticamente exacto, verificado contra una referencia
  // decimal (string-based) en un barrido de 550.011 combinaciones
  // bruto/porcentaje — 0 desviaciones con la implementación actual.

  test("round2: 1.005 -> 1.01 (antes daba 1.00 — el caso emblemático del bug)", () => {
    assert.strictEqual(round2(1.005), 1.01);
  });

  test("round2: bruto=100.50€ + 1% de descuento -> 1.01€ (caso realista, no sintético)", () => {
    // (100.50 * 1) / 100 === 1.005 matemáticamente — mismo caso que arriba,
    // pero llegando desde una operación de negocio real. Antes del fix
    // daba 1.00€, un céntimo por debajo del importe correcto.
    assert.strictEqual(round2((100.5 * 1) / 100), 1.01);
  });

  test("round2: 4 casos más del barrido que antes fallaban, ahora exactos", () => {
    // bruto*pct/100 de combinaciones reales de la auditoría (ver informe) —
    // los 4 son de la lista de 271 desviaciones encontradas con la versión
    // anterior de round2.
    assert.strictEqual(round2((0.92 * 62.5) / 100), 0.58);  // antes: 0.57
    assert.strictEqual(round2((2.04 * 62.5) / 100), 1.28);  // antes: 1.27
    assert.strictEqual(round2((7.5 * 17) / 100), 1.28);     // antes: 1.27
    assert.strictEqual(round2((7.5 * 58.6) / 100), 4.4);    // antes: 4.39
  });

  test("round2: 10.005 y 33.335 siguen correctos tras el fix (ya lo estaban por casualidad, ahora lo están por diseño)", () => {
    assert.strictEqual(round2(10.005), 10.01);
    assert.strictEqual(round2(33.335), 33.34);
  });
}
