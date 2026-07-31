export async function run({ test, assert }) {
  const { generarHoras, toMinutos, toHHMM } = await import("../../assets/shared/js/horarioFranjas.js");

  test("generarHoras: config real de Lyceo (15:30-20:30, 60 min) -> 5 tramos exactos", () => {
    assert.deepEqual(generarHoras("15:30", "20:30", 60), ["15:30", "16:30", "17:30", "18:30", "19:30"]);
  });

  test("generarHoras: el último tramo NO se pasa del fin (t < fin, no <=)", () => {
    // 15:30 a 16:30 con duración 30 -> 15:30, 16:00 — nunca 16:30 (ahí ya no cabe un tramo entero).
    assert.deepEqual(generarHoras("15:30", "16:30", 30), ["15:30", "16:00"]);
  });

  test("generarHoras: duración inválida (0/NaN) cae al valor por defecto de 60", () => {
    assert.deepEqual(generarHoras("15:30", "17:30", 0), generarHoras("15:30", "17:30", 60));
  });

  test("generarHoras: inicio >= fin -> sin tramos", () => {
    assert.deepEqual(generarHoras("20:00", "18:00", 60), []);
  });

  test("toMinutos/toHHMM son inversas para horas válidas", () => {
    assert.equal(toHHMM(toMinutos("09:05")), "09:05");
    assert.equal(toMinutos(toHHMM(725)), 725);
  });
}
