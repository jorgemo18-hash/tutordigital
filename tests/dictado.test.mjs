// EL DICTADO (assets/shared/js/dictado.js), con un reconocimiento de voz
// falso: el de verdad solo existe en un navegador con micrófono.
export async function run({ test, assert }) {
  const { createDictado, dictadoDisponible } = await import("../assets/shared/js/dictado.js");

  function falso() {
    const creados = [];
    class Rec {
      constructor() { creados.push(this); }
      start() { this.empezado = true; }
      stop() { this.onend?.(); }
    }
    return { win: { webkitSpeechRecognition: Rec }, creados };
  }
  const resultado = (texto, isFinal) => ({ results: [Object.assign([{ transcript: texto }], { isFinal })] });

  test("sin reconocimiento de voz (Firefox), no hay dictado", () => {
    assert.equal(dictadoDisponible({}), false);
    assert.equal(createDictado({ win: {}, onTexto: () => {} }).empezar(), false);
  });

  test("dicta en español de España, pasa el texto y avisa al terminar", () => {
    const { win, creados } = falso();
    const textos = [];
    let fin = 0;
    const d = createDictado({ win, onTexto: (t, f) => textos.push([t, f]), onFin: () => { fin += 1; } });
    assert.equal(d.empezar(), true);
    assert.equal(creados[0].lang, "es-ES");
    creados[0].onresult(resultado("dos de restar", false));
    creados[0].onresult(resultado("dos de restar con paréntesis", true));
    creados[0].onend();
    assert.deepEqual(textos, [["dos de restar", false], ["dos de restar con paréntesis", true]]);
    assert.equal(fin, 1);
    assert.equal(d.activo, false);
  });

  test("sin permiso de micrófono lo dice claro", () => {
    const { win, creados } = falso();
    let error = "";
    const d = createDictado({ win, onTexto: () => {}, onError: (m) => { error = m; } });
    d.empezar();
    creados[0].onerror({ error: "not-allowed" });
    assert.ok(error.includes("permiso del micrófono"));
    assert.equal(d.activo, false);
  });
}
