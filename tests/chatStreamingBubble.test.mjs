// finalizeStreamingBubble tenía su propia cadena de .replaceAll() que solo
// escapaba & < > — ni comillas dobles ni simples. Ahora delega en el
// canónico (escHtml), que también escapa comillas — pero eso no es
// observable vía innerHTML en este caso: bub.innerHTML = "&quot;x&quot;"
// se decodifica a "x" en el nodo de texto y el navegador NO vuelve a
// codificar la comilla al releer innerHTML (comprobado empíricamente con
// happy-dom), a diferencia de < > & que sí se re-codifican siempre en
// contenido de texto. Por eso este test no comprueba comillas — esa parte
// del fix ya está cubierta a nivel de string en tests/escHtml.test.mjs —
// y se centra en que < > & siguen escapándose sin regresión tras el
// cambio de implementación.
import { Window } from "happy-dom";

const window = new Window();
globalThis.window = window;
globalThis.document = window.document;

export async function run({ test, assert }) {
  const { createStreamingBubble } = await import(
    "../assets/student/render/chatStreamingBubble.js"
  );

  test("finalizeStreamingBubble sigue escapando < > & sin regresión tras usar el canónico", () => {
    const chatList = document.createElement("div");
    const scrollEl = document.createElement("div");
    const { startStreamingBubble, finalizeStreamingBubble } = createStreamingBubble({
      chatList,
      scrollEl,
      isNearBottom: () => false,
    });

    const { bub } = startStreamingBubble();
    finalizeStreamingBubble(bub, `A & B <script>alert(1)</script> fin\nlínea 2`);

    assert.ok(bub.innerHTML.includes("&amp;"), "& debería escaparse");
    assert.ok(bub.innerHTML.includes("&lt;script&gt;"), "< > deberían escaparse (nunca una etiqueta real)");
    assert.equal(bub.querySelector("script"), null, "no debe crearse ningún nodo <script>");
    assert.ok(bub.innerHTML.includes("<br>"), "los saltos de línea se siguen convirtiendo a <br>");
  });
}
