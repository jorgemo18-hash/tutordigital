export async function run({ test, assert }) {
  const { sustituirVariables, DEFAULT_TEXTO } = await import("../../server/lib/academiaEnvio/textoAcompanamiento.js");

  test("sustituye las 4 variables ({mes}, {anio}, {total}, {familia})", () => {
    const texto = sustituirVariables("Hola {familia}, {mes} de {anio}, total {total}.", {
      mes: 7, anio: 2026, total: 150, familia: "García",
    });
    assert.equal(texto, "Hola García, julio de 2026, total 150.00 €.");
  });

  test("sin recibo (total undefined) -> {total} se sustituye por vacío, no por 'undefined'", () => {
    const texto = sustituirVariables("Total: {total}.", { mes: 7, anio: 2026, total: undefined, familia: "García" });
    assert.equal(texto, "Total: .");
  });

  test("total 0 (recibo con neto exactamente 0) sí se formatea, no se trata como ausente", () => {
    const texto = sustituirVariables("Total: {total}.", { mes: 7, anio: 2026, total: 0, familia: "García" });
    assert.equal(texto, "Total: 0.00 €.");
  });

  test("plantilla vacía/null -> usa el texto por defecto", () => {
    const texto = sustituirVariables(null, { mes: 7, anio: 2026, total: 100, familia: "García" });
    assert.equal(texto, sustituirVariables(DEFAULT_TEXTO, { mes: 7, anio: 2026, total: 100, familia: "García" }));
  });

  test("el texto por defecto incluye {total} (para el aviso no bloqueante del editor)", () => {
    assert.equal(DEFAULT_TEXTO.includes("{total}"), true);
  });

  test("variable repetida se sustituye todas las veces", () => {
    const texto = sustituirVariables("{familia} y {familia} otra vez", { mes: 1, anio: 2026, total: 0, familia: "López" });
    assert.equal(texto, "López y López otra vez");
  });
}
