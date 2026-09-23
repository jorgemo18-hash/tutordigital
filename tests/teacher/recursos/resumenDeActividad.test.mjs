// UN EJERCICIO EN UNA LÍNEA para la lista (shared/generador/resumenDeActividad.js).
export async function run({ test, assert }) {
  const { resumenDeActividad, textoLegible, APARTADOS_EN_EL_RESUMEN } = await import("../../../assets/shared/generador/resumenDeActividad.js");

  test("las fórmulas se leen como en el papel: menos de verdad, sin $ ni LaTeX", () => {
    assert.equal(textoLegible("$-14+(-20)=$ ___"), "−14+(−20)= ___");
    assert.equal(textoLegible("$(-2) \\cdot 5$"), "(−2) · 5");
    assert.equal(textoLegible("$\\lvert -3 \\rvert$"), "| −3 |");
    // Fuera de las fórmulas, un guion es un guion.
    assert.equal(textoLegible("Un sub-tema: $-1$"), "Un sub-tema: −1");
  });

  test("el ejemplo resuelto no sale en el resumen y se corta con … a los primeros apartados", () => {
    const r = resumenDeActividad({
      enunciado: "Calcula:",
      apartados: [{ texto: "$1-2=-1$", resuelto: true }, "$1+1=$ ___", "$2+2=$ ___", { texto: "$3+3=$ ___" }, "$4+4=$ ___"],
    });
    assert.equal(r.enunciado, "Calcula:");
    assert.equal(r.apartados, 4);
    assert.ok(!r.muestra.includes("1−2"));
    assert.equal(r.muestra.split("·").length, APARTADOS_EN_EL_RESUMEN);
    assert.ok(r.muestra.endsWith("…"));
  });

  test("con pocos apartados no hay …, y sin apartados no hay muestra", () => {
    assert.ok(!resumenDeActividad({ enunciado: "A", apartados: ["x", "y"] }).muestra.includes("…"));
    assert.equal(resumenDeActividad({ enunciado: "A" }).muestra, "");
  });
}
