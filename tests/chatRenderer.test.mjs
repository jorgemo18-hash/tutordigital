// add("assistant", text) tenía su propia cadena de .replaceAll() que solo
// escapaba & < > — igual que chatStreamingBubble.js, ahora delega en el
// canónico. La mejora de comillas no es observable vía innerHTML aquí (ver
// nota en chatStreamingBubble.test.mjs) — ese comportamiento ya está
// cubierto a nivel de string en tests/escHtml.test.mjs. Este test protege
// que < > & sigan escapándose sin regresión tras el cambio.
import { Window } from "happy-dom";

const window = new Window();
globalThis.window = window;
globalThis.document = window.document;

export async function run({ test, assert }) {
  const { createChatRenderer } = await import("../assets/student/render/chatRenderer.js");

  test("add('assistant', ...) sigue escapando < > & sin regresión tras usar el canónico", () => {
    const chatList = document.createElement("div");
    const scrollEl = document.createElement("div");
    const renderer = createChatRenderer({ chatList, scrollEl });

    const row = renderer.add(
      "assistant",
      `A & B <script>alert(1)</script> fin`,
      { autoScroll: false }
    );

    const bubble = row.querySelector(".bubble");
    assert.ok(bubble.innerHTML.includes("&amp;"), "& debería escaparse");
    assert.ok(bubble.innerHTML.includes("&lt;script&gt;"), "< > deberían escaparse (nunca una etiqueta real)");
    assert.equal(bubble.querySelector("script"), null, "no debe crearse ningún nodo <script>");
  });
}
