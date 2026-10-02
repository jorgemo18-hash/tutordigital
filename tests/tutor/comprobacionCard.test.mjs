import { Window } from "happy-dom";

const window = globalThis.window || new Window();
globalThis.window = window;
globalThis.document = window.document;
globalThis.requestAnimationFrame ||= (fn) => fn();

// LA TARJETA ✓/✗ DEL COMPROBADOR en el chat del alumno: se para en el primer
// ✗, sale encima de la burbuja del tutor que se está escribiendo y nunca
// interpreta como HTML lo que llega del servidor.
export async function run({ test, assert }) {
  const { createComprobacionCard, hitosVisibles } = await import("../../assets/student/render/comprobacionCard.js");
  const { resumenDelVeredicto } = await import("../../server/lib/orchestrator/comprobadorEnElChat.js");

  function montar() {
    document.body.innerHTML = '<div id="chat"></div>';
    const chatList = document.getElementById("chat");
    const { addComprobacion } = createComprobacionCard({ chatList, scrollEl: chatList, isNearBottom: () => false });
    return { chatList, addComprobacion };
  }
  const RESUMEN = { apartado: "b", hitos: [
    { titulo: "El paréntesis", estado: "hecho" },
    { titulo: "Las x y los números", estado: "mal" },
    { titulo: "Despejar la x", estado: "pendiente" },
  ], lineas: [], todoHecho: false };

  test("la lista se para en el primer ✗: lo que viene después no se enseña", () => {
    assert.deepEqual(hitosVisibles(RESUMEN.hitos).map((h) => h.titulo), ["El paréntesis", "Las x y los números"]);
    const { chatList, addComprobacion } = montar();
    addComprobacion(RESUMEN);
    const pasos = [...chatList.querySelectorAll(".comprobacionPaso")].map((li) => li.textContent);
    assert.deepEqual(pasos, ["✓El paréntesis", "✗Las x y los números"]);
    assert.equal(chatList.querySelector(".comprobacionTitulo").textContent, "Apartado b)");
    assert.equal(chatList.textContent.includes("Despejar la x"), false);
  });

  test("todo bien: todos los pasos con ✓ y la tarjeta marcada como hecha", () => {
    const { chatList, addComprobacion } = montar();
    addComprobacion({ apartado: "a", hitos: [{ titulo: "A", estado: "hecho" }, { titulo: "B", estado: "hecho" }], todoHecho: true });
    assert.equal(chatList.querySelector(".comprobacionCard").classList.contains("comprobacionCard--hecho"), true);
    assert.equal(chatList.querySelectorAll(".comprobacionPaso--hecho").length, 2);
  });

  test("sale ENCIMA de la burbuja del tutor que se está escribiendo", () => {
    const { chatList, addComprobacion } = montar();
    chatList.innerHTML = '<div class="row u" id="alumno"></div><div class="row a" id="tutor"><div class="bubble bubble--streaming"></div></div>';
    addComprobacion(RESUMEN);
    const filas = [...chatList.children].map((f) => f.id || (f.querySelector(".comprobacionCard") ? "tarjeta" : "?"));
    assert.deepEqual(filas, ["alumno", "tarjeta", "tutor"]);
  });

  test("lo que no se ha podido leer se avisa; nada se interpreta como HTML", () => {
    const { chatList, addComprobacion } = montar();
    addComprobacion({ ...RESUMEN, hitos: [{ titulo: "<img src=x onerror=alert(1)>", estado: "hecho" }], lineas: [{ texto: "x", estado: "duda" }] });
    assert.equal(chatList.querySelector("img") === null, true);
    assert.equal(chatList.querySelector(".comprobacionNota") !== null, true);
  });

  test("el resumen que manda el servidor: letra del apartado, títulos neutros y escalado en el peldaño 4", () => {
    const actividad = { metodo: { hitos: [{ id: "aislar", alumno: "El término con x" }, { id: "despejar", alumno: "Despejar la x" }] } };
    const v = { apartado: 1, hitos: [{ id: "aislar", estado: "mal" }, { id: "despejar", estado: "pendiente" }], comprobacion: { lineas: [{ texto: "3x = 23", leida: true, equivalente: false }] }, nivel: 4, todoHecho: false };
    const r = resumenDelVeredicto(v, actividad);
    assert.equal(r.apartado, "b");
    assert.deepEqual(r.hitos.map((h) => h.titulo), ["El término con x", "Despejar la x"]);
    assert.equal(r.lineas[0].estado, "mal");
    assert.equal(r.escalado, true);
  });

  test("cableado: la ruta manda «comprobacion» antes de los tokens, y el alumno la pinta", async () => {
    const fs = await import("node:fs");
    const leer = (r) => fs.readFileSync(new URL(`../../${r}`, import.meta.url), "utf8");
    const ruta = leer("server/routes/v1/chat.routes.js");
    assert.match(ruta, /sseWrite\(reply\.raw, \{ type: "comprobacion", comprobacion \}\)/);
    assert.match(ruta, /handleMessage\(\{[^}]*onComprobacion \}\)/);
    assert.match(leer("server/lib/orchestrator/chatHandler.js"), /onComprobacion\(resumenDelVeredicto\(veredicto\.v, veredicto\.actividad\)\)/);
    assert.match(leer("assets/shared/js/chatapi.js"), /event\.type === "comprobacion"[\s\S]{0,80}onComprobacion\?\.\(event\.comprobacion\)/);
    assert.match(leer("assets/student/student.js"), /onComprobacion: addComprobacion/);
  });
}
