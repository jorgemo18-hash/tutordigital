// desglosarDescuentosRecurrentes() — desglosa los descuentos recurrentes de
// UN alumno en líneas con su propio importe: los acumulables entran todos,
// de los no-acumulables solo el de mayor porcentaje. Cada importe se
// calcula sobre el bruto del alumno de forma independiente (no se
// encadenan descuentos sobre el resultado de otros).

export async function run({ test, assert }) {
  const { desglosarDescuentosRecurrentes, round2 } =
    await import("../../server/lib/academiaRecibos/calculos.js");

  test("sin descuentos -> desglose vacío", () => {
    assert.deepStrictEqual(desglosarDescuentosRecurrentes([], 100), []);
    assert.deepStrictEqual(desglosarDescuentosRecurrentes(undefined, 100), []);
  });

  test("un único acumulable -> una línea con el importe esperado", () => {
    const resultado = desglosarDescuentosRecurrentes(
      [{ concepto: "Beca", porcentaje: 15, acumulable: true }],
      200
    );
    assert.deepStrictEqual(resultado, [{ concepto: "Beca", porcentaje: 15, importe: 30 }]);
  });

  test("varios acumulables -> todos entran, cada uno sobre el bruto (no se encadenan)", () => {
    const resultado = desglosarDescuentosRecurrentes(
      [
        { concepto: "A", porcentaje: 10, acumulable: true },
        { concepto: "B", porcentaje: 20, acumulable: true },
      ],
      100
    );
    assert.deepStrictEqual(resultado, [
      { concepto: "A", porcentaje: 10, importe: 10 },
      { concepto: "B", porcentaje: 20, importe: 20 },
    ]);
  });

  test("varios no-acumulables -> solo entra el de mayor porcentaje", () => {
    const resultado = desglosarDescuentosRecurrentes(
      [
        { concepto: "Promo chica", porcentaje: 10, acumulable: false },
        { concepto: "Promo grande", porcentaje: 25, acumulable: false },
        { concepto: "Promo media", porcentaje: 15, acumulable: false },
      ],
      100
    );
    assert.deepStrictEqual(resultado, [{ concepto: "Promo grande", porcentaje: 25, importe: 25 }]);
  });

  test("empate entre no-acumulables -> gana el primero encontrado (comportamiento documentado, no aleatorio)", () => {
    const resultado = desglosarDescuentosRecurrentes(
      [
        { concepto: "Primera", porcentaje: 20, acumulable: false },
        { concepto: "Segunda", porcentaje: 20, acumulable: false },
      ],
      100
    );
    assert.strictEqual(resultado.length, 1);
    assert.strictEqual(resultado[0].concepto, "Primera");
  });

  test("mezcla: acumulables + el mejor no-acumulable, el resto de no-acumulables se descarta", () => {
    const resultado = desglosarDescuentosRecurrentes(
      [
        { concepto: "Beca", porcentaje: 10, acumulable: true },
        { concepto: "Promo chica", porcentaje: 5, acumulable: false },
        { concepto: "Promo grande", porcentaje: 30, acumulable: false },
      ],
      100
    );
    assert.deepStrictEqual(resultado, [
      { concepto: "Beca", porcentaje: 10, importe: 10 },
      { concepto: "Promo grande", porcentaje: 30, importe: 30 },
    ]);
  });

  test("porcentaje 0 o negativo se filtra siempre, acumulable o no", () => {
    const resultado = desglosarDescuentosRecurrentes(
      [
        { concepto: "Cero", porcentaje: 0, acumulable: true },
        { concepto: "Negativo", porcentaje: -5, acumulable: false },
      ],
      100
    );
    assert.deepStrictEqual(resultado, []);
  });

  test("bruto 0 -> todos los importes son 0, pero las líneas se mantienen", () => {
    const resultado = desglosarDescuentosRecurrentes(
      [{ concepto: "Beca", porcentaje: 50, acumulable: true }],
      0
    );
    assert.deepStrictEqual(resultado, [{ concepto: "Beca", porcentaje: 50, importe: 0 }]);
  });

  test("descuento del 100% -> importe igual al bruto completo", () => {
    const resultado = desglosarDescuentosRecurrentes(
      [{ concepto: "Total", porcentaje: 100, acumulable: true }],
      66.5
    );
    assert.deepStrictEqual(resultado, [{ concepto: "Total", porcentaje: 100, importe: 66.5 }]);
  });

  test("acumulables que suman más del 100% del bruto -> no se limitan entre sí (documentado: no se encadenan)", () => {
    const resultado = desglosarDescuentosRecurrentes(
      [
        { concepto: "A", porcentaje: 60, acumulable: true },
        { concepto: "B", porcentaje: 60, acumulable: true },
      ],
      100
    );
    const sumaImportes = resultado.reduce((s, d) => s + d.importe, 0);
    assert.strictEqual(sumaImportes, 120); // > bruto — es la responsabilidad del llamador, no de esta función
  });

  test("cada línea usa round2 — caso que fuerza redondeo de tercios", () => {
    const resultado = desglosarDescuentosRecurrentes(
      [{ concepto: "Tercio", porcentaje: 33.333, acumulable: true }],
      100
    );
    assert.strictEqual(resultado[0].importe, round2((100 * 33.333) / 100));
    assert.strictEqual(resultado[0].importe, 33.33);
  });
}
