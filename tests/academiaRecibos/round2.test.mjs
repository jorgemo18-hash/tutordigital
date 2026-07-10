// round2() — único punto de redondeo a céntimos de calculos.js (antes
// triplicado inline como Math.round(x*100)/100 en 3 sitios de este archivo
// + una 4ª copia en generarRecibo.js, ahora consolidados aquí).
//
// IMPORTANTE: esta función NO implementa un redondeo half-up matemáticamente
// exacto — hereda el error de representación binaria de coma flotante de
// `value * 100`. Los tests de este archivo documentan el comportamiento
// REAL (incluido el caso conocido que se desvía de lo esperado), no lo que
// "debería" hacer un redondeo perfecto — ver el informe de la auditoría
// para la decisión pendiente sobre si corregirlo.

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

  test("round2: negativos — mismo comportamiento de Math.round en el .5 (hacia +Infinity, no hacia fuera)", () => {
    assert.strictEqual(round2(-10.001), -10);
    // Math.round(-2.5) === -2 en JS (redondea hacia +Infinity, no "hacia
    // fuera" como el half-up de positivos) — documentado, no corregido aquí.
    assert.strictEqual(round2(-0.005), -0);
  });

  test("round2: NaN/undefined/null se tratan como 0 (mismo criterio que el resto del archivo, Number(x) || 0)", () => {
    assert.strictEqual(round2(NaN), 0);
    assert.strictEqual(round2(undefined), 0);
    assert.strictEqual(round2(null), 0);
    assert.strictEqual(round2("no-es-numero"), 0);
  });

  // ── el defecto conocido de coma flotante (documentado, no corregido) ────

  test("round2: DEFECTO CONOCIDO — 1.005 redondea a 1.00, no a 1.01 (error de coma flotante en 1.005*100)", () => {
    // 1.005 * 100 === 100.49999999999999 en JS (no 100.5 exacto), así que
    // Math.round lo baja a 100 en vez de subirlo a 101. Este test documenta
    // el comportamiento actual — NO es la conducta "correcta" de un
    // redondeo half-up real. Ver informe: esto puede producir un descuento
    // real 1 céntimo por debajo del esperado para ciertas combinaciones de
    // bruto/porcentaje (ver reciboIntegracion.test.mjs y el informe escrito
    // aparte con más ejemplos).
    assert.strictEqual(round2(1.005), 1);
  });

  test("round2: el mismo defecto se reproduce con bruto=100.50 y descuento=1% (caso realista, no sintético)", () => {
    // (100.50 * 1) / 100 === 1.005 matemáticamente — el mismo caso de
    // arriba, pero llegando desde una operación de negocio real en vez de
    // un literal. Confirma que el defecto es alcanzable desde calcularDescuento.
    const importeCalculado = round2((100.5 * 1) / 100);
    assert.strictEqual(importeCalculado, 1); // "debería" ser 1.01 con half-up exacto
  });
}
