import fs from "node:fs";
const RAIZ = new URL("../../", import.meta.url).pathname;

// "[PASO_COMPLETADO]" salió dos veces en pantalla en las conversaciones
// reales: en streaming los trozos iban al navegador antes de quitar la señal.
export async function run({ test, assert }) {
  const { crearFiltroDeSenales, quitarSenales } = await import("../../server/lib/chat/filtroDeSenales.js");
  const { procesarRespuestaTutor } = await import("../../server/lib/chatPrompt.js");

  // Pasa el texto troceado de todas las formas posibles y junta lo enviado.
  function porTrozos(texto, tam) {
    let salida = "";
    const f = crearFiltroDeSenales((t) => { salida += t; });
    for (let i = 0; i < texto.length; i += tam) f.push(texto.slice(i, i + tam));
    f.flush();
    return salida;
  }
  const todosLosTrozos = (texto) => [1, 2, 3, 5, 7, 11, texto.length].map((n) => porTrozos(texto, n));

  test("REGRESIÓN: la señal no llega al navegador, venga como venga troceada", () => {
    const t = "Exacto, 'yo' es el sujeto. ¿Y el verbo? [PASO_COMPLETADO]";
    for (const r of todosLosTrozos(t)) assert.equal(r, "Exacto, 'yo' es el sujeto. ¿Y el verbo? ");
  });

  test("las otras señales y sus variantes tampoco", () => {
    for (const s of ["[PASOS_COMPLETADOS:2]", "[paso completado]", "[ ESCALAR_PROFESOR: no avanza con las fracciones ]", "[PASOS_COMPLETADOS : 3]"]) {
      for (const r of todosLosTrozos(`Bien. ${s} Sigue.`)) assert.equal(r, "Bien.  Sigue.", s);
    }
  });

  test("los corchetes de matemáticas pasan intactos", () => {
    const t = "El intervalo [1, 3] y el [PASO] de antes; la matriz [a b] y x∈[-2,5].";
    for (const r of todosLosTrozos(t)) assert.equal(r, t);
  });

  test("un '[' sin cerrar al final no se pierde", () => {
    for (const r of todosLosTrozos("Mira [1, 2")) assert.equal(r, "Mira [1, 2");
  });

  test("la respuesta guardada queda limpia aunque vengan dos señales", () => {
    const r = procesarRespuestaTutor("Muy bien. [PASOS_COMPLETADOS:2] [PASO_COMPLETADO] ¿Seguimos?");
    assert.equal(r.stepsCompleted, 2);
    assert.equal(r.reply, "Muy bien. ¿Seguimos?");
    const v = procesarRespuestaTutor("Vale. [paso completado]");
    assert.equal(v.stepsCompleted, 1, "la variante con espacio también cuenta el paso");
    assert.equal(quitarSenales("a [ESCALAR_PROFESOR: x] b"), "a b");
  });

  test("REGRESIÓN: el streaming pasa por el filtro, no directo al navegador", () => {
    const src = fs.readFileSync(`${RAIZ}server/lib/chat.js`, "utf8");
    assert.match(src, /crearFiltroDeSenales\(onChunk\)/);
    assert.equal(/stream\.on\("text"[\s\S]{0,120}onChunk\(token\)/.test(src), false);
  });
}
