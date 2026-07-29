// El helper canónico (assets/shared/js/escHtml.js) ahora es consumido
// también desde server/ (email.js, ausenciaEmailTemplate.js) — antes cada
// uno tenía su propia copia, alguna más laxa (sin escapar comillas
// simples). Este test fija el contrato: los 5 caracteres HTML peligrosos
// deben quedar escapados siempre.
export async function run({ test, assert }) {
  const { escHtml } = await import("../assets/shared/js/escHtml.js");

  test("escHtml escapa & < > \" '", () => {
    assert.equal(
      escHtml(`& < > " '`),
      "&amp; &lt; &gt; &quot; &#39;"
    );
  });

  test("escHtml no revienta con null/undefined", () => {
    assert.equal(escHtml(null), "");
    assert.equal(escHtml(undefined), "");
  });

  test("escHtml preserva números que no son 0/'' de forma segura", () => {
    assert.equal(escHtml(0), "0");
  });
}
