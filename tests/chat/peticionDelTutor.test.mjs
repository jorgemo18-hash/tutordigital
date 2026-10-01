// LA PETICIÓN DEL TUTOR A LA API: caché, sin temperature y con Sonnet 5.5.
//
// No llama a la IA: fija la forma de la petición, que es donde se decide
// cuánto cuesta cada mensaje del alumno y si la API la acepta.
import { readFileSync } from "node:fs";

export async function run({ test, assert }) {
  const { peticionDelTutor, MAX_TOKENS_TUTOR } = await import("../../server/lib/chat/peticionDelTutor.js");
  const { partesDelPromptDelTutor, buildTutorInstructions } = await import("../../server/lib/chatPrompt.js");
  const { TUTOR_MODEL, SONNET_MODEL } = await import("../../server/lib/anthropic.js");

  const MAPA = { steps: [{ index: 0, title: "Aislar la x", completed: false }, { index: 1, title: "Comprobar", completed: false }], currentStep: 0 };
  const ALUMNO = { alumno_nombre: "Nora", nivel_educativo: "1.º de ESO", asignatura: "Matemáticas" };
  const historial = [
    { role: "user", content: "2x + 5 = 9, ¿cómo empiezo?" },
    { role: "assistant", content: "¿Qué número estorba a la x?" },
  ];
  const actual = { role: "user", content: [{ type: "text", text: "el 5" }] };

  test("el tutor usa Sonnet 5.5; los informes siguen en su modelo", () => {
    assert.equal(TUTOR_MODEL, "claude-sonnet-5-5");
    assert.notEqual(SONNET_MODEL, TUTOR_MODEL);
  });

  test("lo que cambia de un mensaje a otro (intentos y mapa) NO está en la parte fija", () => {
    const a = partesDelPromptDelTutor("deberes", null, 0, ALUMNO, MAPA, "2x + 5 = 9");
    const b = partesDelPromptDelTutor("deberes", null, 3,
      ALUMNO, { ...MAPA, steps: [{ ...MAPA.steps[0], completed: true }, MAPA.steps[1]], currentStep: 1 }, "2x + 5 = 9");
    assert.equal(a.fijo, b.fijo, "la parte fija tiene que ser idéntica para que la caché acierte");
    assert.notEqual(a.variable, b.variable);
    assert.match(a.variable, /Intentos con el mismo error: 0/);
    assert.match(a.variable, /MAPA DE PROGRESO/);
    assert.equal(/Intentos con el mismo error|MAPA DE PROGRESO/.test(a.fijo), false);
    assert.match(a.fijo, /2x \+ 5 = 9/, "el enunciado es fijo");
  });

  test("el prompt completo sigue siendo la parte fija seguida de la variable", () => {
    const p = partesDelPromptDelTutor("deberes", null, 0, ALUMNO, MAPA, "x");
    assert.equal(buildTutorInstructions("deberes", null, 0, ALUMNO, MAPA, "x"), `${p.fijo}\n${p.variable}`);
  });

  const partes = partesDelPromptDelTutor("deberes", null, 0, ALUMNO, MAPA, "2x + 5 = 9");
  const peticion = peticionDelTutor({ model: TUTOR_MODEL, partes, historial, mensajeActual: actual });

  test("caché: marca al final de la parte fija y en el último mensaje del historial", () => {
    assert.equal(peticion.system[0].text, partes.fijo);
    assert.deepEqual(peticion.system[0].cache_control, { type: "ephemeral" });
    assert.equal(peticion.system[1].text, partes.variable);
    assert.equal(peticion.system[1].cache_control, undefined);
    const ultimoDelHistorial = peticion.messages[1];
    assert.equal(ultimoDelHistorial.role, "assistant");
    assert.equal(ultimoDelHistorial.content[0].text, "¿Qué número estorba a la x?");
    assert.deepEqual(ultimoDelHistorial.content[0].cache_control, { type: "ephemeral" });
  });

  test("caché: el mensaje nuevo del alumno va sin marca, al final, y el historial no se toca", () => {
    assert.equal(peticion.messages.length, 3);
    assert.equal(peticion.messages[2], actual);
    assert.equal(peticion.messages[0].content, "2x + 5 = 9, ¿cómo empiezo?");
    assert.equal(typeof historial[1].content, "string", "no muta el historial de quien llama");
  });

  test("sin historial: solo la marca de la parte fija", () => {
    const p = peticionDelTutor({ model: TUTOR_MODEL, partes, historial: [], mensajeActual: actual });
    assert.deepEqual(p.messages, [actual]);
    assert.ok(p.system[0].cache_control);
  });

  test("sin parte variable no se manda un bloque vacío", () => {
    const p = peticionDelTutor({ model: TUTOR_MODEL, partes: { fijo: "x", variable: "" }, historial: [], mensajeActual: actual });
    assert.equal(p.system.length, 1);
  });

  test("REGRESIÓN: sin temperature (Sonnet 5.5 la rechaza con un 400)", () => {
    assert.equal("temperature" in peticion, false);
    assert.equal(peticion.max_tokens, MAX_TOKENS_TUTOR);
    assert.equal(peticion.model, TUTOR_MODEL);
  });

  test("cableado: chat.js monta la petición aquí y la ruta usa el modelo del tutor", () => {
    const chat = readFileSync(new URL("../../server/lib/chat.js", import.meta.url), "utf8");
    assert.match(chat, /peticionDelTutor\(\{/);
    assert.equal(/reqParams\.temperature/.test(chat), false);
    const ruta = readFileSync(new URL("../../server/routes/v1/chat.routes.js", import.meta.url), "utf8");
    assert.match(ruta, /getEnv\("ANTHROPIC_MODEL", TUTOR_MODEL\)/);
  });
}
