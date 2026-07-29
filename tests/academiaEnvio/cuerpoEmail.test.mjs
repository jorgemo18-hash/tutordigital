// buildCuerpoHtml() interpolaba cuerpo/textosLopd sin ningún escapado
// (hallazgo documentado en docs/deuda-tecnica.md, sección "Email a
// familias"). Ahora: `cuerpo` llega ya escapado desde sustituirVariables()
// y no se vuelve a tocar aquí (evita doble escapado); `textosLopd` se
// escapa en esta función, su única frontera de interpolación HTML.
export async function run({ test, assert }) {
  const { buildCuerpoHtml } = await import("../../server/lib/academiaEnvio/cuerpoEmail.js");

  test("cuerpo ya escapado NO se vuelve a escapar (evita doble escapado)", () => {
    const cuerpoYaEscapado = "Hola O&#39;Connor, adjuntamos el recibo.";
    const html = buildCuerpoHtml(cuerpoYaEscapado, []);
    assert.ok(html.includes("O&#39;Connor"), "debe conservar el escapado tal cual llegó");
    assert.equal(html.includes("&amp;#39;"), false, "no debe doble-escapar la entidad ya presente");
  });

  test("textosLopd se escapa — un texto legal con < > & \" ' no rompe el HTML del email", () => {
    const html = buildCuerpoHtml("Cuerpo.", [`Aviso <legal> & "importante" de O'Connor`]);
    assert.ok(html.includes("Aviso &lt;legal&gt; &amp; &quot;importante&quot; de O&#39;Connor"));
    assert.equal(html.includes("<legal>"), false, "no debe quedar una etiqueta sin escapar");
  });

  test("varios textosLopd activos se unen y se escapan cada uno", () => {
    const html = buildCuerpoHtml("Cuerpo.", ["Texto A & B.", "Texto <C>."]);
    assert.ok(html.includes("Texto A &amp; B. Texto &lt;C&gt;."));
  });

  test("sin textosLopd -> no añade el párrafo del footer", () => {
    const html = buildCuerpoHtml("Cuerpo.", []);
    assert.equal(html.includes("<p style="), false);
  });
}
