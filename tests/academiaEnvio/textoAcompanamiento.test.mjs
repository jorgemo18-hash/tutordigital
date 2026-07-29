export async function run({ test, assert }) {
  const {
    sustituirVariables, DEFAULT_TEXTO_COMPLETO, DEFAULT_TEXTO_SOLO_RECIBO, DEFAULT_TEXTO_SOLO_INFORME,
  } = await import("../../server/lib/academiaEnvio/textoAcompanamiento.js");

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

  test("plantilla vacía/null -> usa el fallback de ESE caso, no el de otro", () => {
    const vars = { mes: 7, anio: 2026, total: 100, familia: "García" };
    assert.equal(sustituirVariables(null, vars, DEFAULT_TEXTO_SOLO_RECIBO), sustituirVariables(DEFAULT_TEXTO_SOLO_RECIBO, vars));
    assert.equal(sustituirVariables(null, vars, DEFAULT_TEXTO_SOLO_INFORME), sustituirVariables(DEFAULT_TEXTO_SOLO_INFORME, vars));
  });

  test("sin fallback explícito -> usa DEFAULT_TEXTO_COMPLETO", () => {
    const vars = { mes: 7, anio: 2026, total: 100, familia: "García" };
    assert.equal(sustituirVariables(null, vars), sustituirVariables(DEFAULT_TEXTO_COMPLETO, vars));
  });

  test("el texto por defecto de 'completo' y 'solo_recibo' incluyen {total}; el de 'solo_informe' no", () => {
    assert.equal(DEFAULT_TEXTO_COMPLETO.includes("{total}"), true);
    assert.equal(DEFAULT_TEXTO_SOLO_RECIBO.includes("{total}"), true);
    assert.equal(DEFAULT_TEXTO_SOLO_INFORME.includes("{total}"), false);
  });

  test("el texto por defecto de 'solo_recibo' no menciona el informe, y el de 'solo_informe' no menciona el recibo", () => {
    assert.equal(DEFAULT_TEXTO_SOLO_RECIBO.includes("informe"), false);
    assert.equal(DEFAULT_TEXTO_SOLO_INFORME.includes("recibo"), false);
  });

  test("variable repetida se sustituye todas las veces", () => {
    const texto = sustituirVariables("{familia} y {familia} otra vez", { mes: 1, anio: 2026, total: 0, familia: "López" });
    assert.equal(texto, "López y López otra vez");
  });

  test("{familia} se escapa al sustituir — un nombre con < > & \" ' no rompe el HTML del email", () => {
    const texto = sustituirVariables("Hola {familia}.", {
      mes: 1, anio: 2026, total: 0, familia: `<b>O'Connor</b> & "Cía"`,
    });
    assert.equal(texto, "Hola &lt;b&gt;O&#39;Connor&lt;/b&gt; &amp; &quot;Cía&quot;.");
  });

  test("la plantilla montada NO se escapa (solo {familia}) — evita doble escapado del propio {familia} ya escapado", () => {
    // Si se escapara el resultado entero, "&#39;" (la comilla ya escapada de familia)
    // se convertiría en "&amp;#39;" — este test falla si eso ocurre.
    const texto = sustituirVariables("Hola {familia}, & bienvenidos.", { mes: 1, anio: 2026, total: 0, familia: "O'Connor" });
    assert.equal(texto, "Hola O&#39;Connor, & bienvenidos.");
  });

  test("\\n -> <br> se aplica DESPUÉS de escapar, sobre el texto ya sustituido completo (plantilla con saltos de línea, p.ej. texto de inscripción)", () => {
    const texto = sustituirVariables("Hola {familia}.\nSegunda línea.\nTercera línea.", {
      mes: 1, anio: 2026, total: 0, familia: "García",
    });
    assert.equal(texto, "Hola García.<br>Segunda línea.<br>Tercera línea.");
  });
}
