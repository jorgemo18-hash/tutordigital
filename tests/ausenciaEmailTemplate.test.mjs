// buildAusenciaEmailHtml tenía su propia copia de escHtml que no escapaba
// comilla simple (server/lib/academiaDiario/ausenciaEmailTemplate.js, antes
// de consolidar contra el helper canónico). Este test fija que un nombre
// de familia con apóstrofe queda escapado, no insertado en crudo — falla
// si se revierte al escHtml local antiguo (String(str ?? "").replace...
// sin la línea de comilla simple).
export async function run({ test, assert }) {
  const { buildAusenciaEmailHtml } = await import(
    "../server/lib/academiaDiario/ausenciaEmailTemplate.js"
  );

  test("buildAusenciaEmailHtml escapa comillas simples en los campos interpolados", () => {
    const html = buildAusenciaEmailHtml({
      alumnoNombre: "O'Connor",
      familiaNombre: "Familia D'Angelo",
      fecha: "2026-07-20",
      hora: "17:00",
      motivo: "cita médica",
      config: { nombre_emisor: "Academia L'Étoile" },
      tenantNombre: "",
    });

    assert.ok(html.includes("O&#39;Connor"), "alumnoNombre debería escapar la comilla simple");
    assert.ok(html.includes("Familia D&#39;Angelo"), "familiaNombre debería escapar la comilla simple");
    assert.ok(html.includes("Academia L&#39;Étoile"), "nombreAcademia debería escapar la comilla simple");
    assert.equal(html.includes("O'Connor"), false, "no debería quedar la comilla simple sin escapar");
  });
}
