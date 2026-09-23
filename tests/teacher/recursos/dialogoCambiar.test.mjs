import { Window } from "happy-dom";

// EL DIÁLOGO "CAMBIAR ESTE EJERCICIO" (js/recursos/dialogoCambiar.js): las
// tres formas de cambiarlo y que no llama a nada por su cuenta.
export async function run({ test, assert }) {
  const { abrirDialogoCambiar } = await import("../../../assets/teacher/js/recursos/dialogoCambiar.js");

  function abrir(onPedido = async () => ({ hecho: true })) {
    const win = new Window();
    const doc = win.document;
    const avisos = { azar: 0, clave: [], pedido: [], cerrado: 0 };
    const d = abrirDialogoCambiar({
      doc, win, orden: 2,
      hueco: { clave: "a", nombre: "Suma", concepto: "C", dificultad: 1 },
      resumen: "Calcula:",
      baterias: [{ clave: "a", nombre: "Suma", dificultad: 1, saber: "A.3" }, { clave: "b", nombre: "Resta", dificultad: 2 }],
      onAzar: () => { avisos.azar += 1; },
      onClave: (c) => avisos.clave.push(c),
      onPedido: async (conv) => { avisos.pedido.push(conv); return onPedido(conv); },
      onCerrar: () => { avisos.cerrado += 1; },
    });
    const aceptar = () => [...doc.querySelectorAll(".rc-modal__f button")].find((b) => b.textContent.startsWith("Cambiar"));
    return { win, doc, d, avisos, aceptar };
  }
  const tick = () => new Promise((r) => setTimeout(r, 0));

  test("por defecto es 'otro del mismo tipo', y confirmar solo avisa", () => {
    const { d, avisos, aceptar } = abrir();
    assert.equal(d.modo, "azar");
    aceptar().click();
    assert.equal(avisos.azar, 1);
  });

  test("elegir del catálogo: pulsar un tipo lo elige; sin elegir, avisa en vez de cambiar", () => {
    const { doc, d, avisos, aceptar } = abrir();
    doc.querySelectorAll(".rc-opt")[2].click();
    aceptar().click();
    assert.equal(avisos.clave.length, 0);
    assert.equal(doc.querySelector(".rc-modal__aviso").hidden, false);
    doc.querySelector('.rc-cat__fila[data-clave="b"]').click();
    assert.equal(d.modo, "catalogo");
    aceptar().click();
    assert.deepEqual(avisos.clave, ["b"]);
    assert.ok(doc.querySelector('.rc-cat__fila[data-clave="a"]').textContent.includes("el de ahora"));
    // El saber, solo el código, a la izquierda del nombre; sin saber, nada.
    const primero = doc.querySelector('.rc-cat__fila[data-clave="a"]').firstElementChild;
    assert.equal(primero.className, "rc-cat__saber");
    assert.equal(primero.textContent, "A.3");
    assert.equal(doc.querySelector('.rc-cat__fila[data-clave="b"] .rc-cat__saber'), null);
  });

  test("pedir algo concreto lleva la conversación: la pregunta de la IA entra como turno", async () => {
    let n = 0;
    const { doc, avisos, aceptar } = abrir(async () => (n++ === 0 ? { pregunta: "¿Con paréntesis?" } : { hecho: true }));
    const ta = doc.querySelector(".rc-ta");
    ta.value = "uno de restas";
    ta.dispatchEvent(new doc.defaultView.Event("focus"));
    aceptar().click();
    await tick();
    assert.equal(doc.querySelector(".rc-modal__aviso").textContent, "¿Con paréntesis?");
    ta.value = "sí";
    aceptar().click();
    await tick();
    assert.deepEqual(avisos.pedido[1].map((t) => t.rol), ["profesor", "asistente", "profesor"]);
  });

  test("pedir sin escribir nada no llama a la IA", () => {
    const { doc, avisos, aceptar } = abrir();
    doc.querySelectorAll(".rc-opt")[1].click();
    aceptar().click();
    assert.equal(avisos.pedido.length, 0);
  });

  test("Cancelar y Escape cierran y avisan", () => {
    const a = abrir();
    [...a.doc.querySelectorAll(".rc-modal__f button")].find((b) => b.textContent === "Cancelar").click();
    assert.equal(a.avisos.cerrado, 1);
    assert.equal(a.doc.querySelector(".rc-ovl"), null);
    const b = abrir();
    b.doc.dispatchEvent(new b.win.KeyboardEvent("keydown", { key: "Escape" }));
    assert.equal(b.avisos.cerrado, 1);
  });

  test("en modo AÑADIR los textos son de añadir y el catálogo no marca 'el de ahora'", () => {
    const win = new Window();
    const doc = win.document;
    let azar = 0;
    abrirDialogoCambiar({
      doc, win, modo: "anadir", orden: 4, hueco: null, resumen: "Va al final",
      baterias: [{ clave: "a", nombre: "Suma", dificultad: 1 }],
      onAzar: () => { azar += 1; }, onClave() {}, onPedido: async () => ({}),
    });
    assert.equal(doc.querySelector(".rc-modal__h h2").textContent, "Añadir un ejercicio");
    assert.ok(!doc.querySelector(".rc-cat").textContent.includes("el de ahora"));
    [...doc.querySelectorAll(".rc-modal__f button")].find((b) => b.textContent === "Añadir el ejercicio").click();
    assert.equal(azar, 1);
  });
}
