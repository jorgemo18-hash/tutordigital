import assert from "node:assert/strict";

// Regresión del bug real (dos veces, en dos copias del mismo código):
// convertirHeicBase64() devuelve { base64, mime }, pero un caller
// desestructuraba { base64, mediaType } — clave inexistente, mediaType
// llegaba undefined a Claude, que rechazaba la petición con
// "media_type: Field required" (confirmado en Sentry, corregido en gastos
// el 2026-07-01 — commit c918491 — nunca portado a inscripciones hasta
// ahora). Estos tests verifican qué le llega REALMENTE a messages.create(),
// no solo que la función no lance — es justo lo que faltaba para que este
// bug no pasara desapercibido.

function makeFakeClient({ text = '{"ok":true}' } = {}) {
  const calls = [];
  return {
    client: {
      messages: {
        create: async (params) => {
          calls.push(params);
          return { content: [{ type: "text", text }] };
        },
      },
    },
    calls,
  };
}

export async function run({ test }) {
  const { extraerJsonConVision } = await import("../server/lib/anthropicVisionOcr.js");
  const { extraerDatosGasto } = await import("../server/lib/academiaFinanzas/gastoExtraccion.js");
  const { extraerDatosInscripcion } = await import("../server/lib/academiaAlumnoOcr.js");
  const { SONNET_MODEL } = await import("../server/lib/anthropic.js");

  // ── extraerJsonConVision — el helper compartido ──────────────────────────

  test("extraerJsonConVision manda el media_type recibido, no undefined (regresión del bug real)", async () => {
    const { client, calls } = makeFakeClient();
    await extraerJsonConVision(client, { base64: "AAA", mediaType: "image/jpeg", prompt: "extrae" });
    const block = calls[0].messages[0].content[0];
    assert.strictEqual(block.source.media_type, "image/jpeg");
    assert.notStrictEqual(block.source.media_type, undefined);
  });

  test("extraerJsonConVision usa content type 'document' para PDF, 'image' para el resto", async () => {
    const { client: c1, calls: calls1 } = makeFakeClient();
    await extraerJsonConVision(c1, { base64: "AAA", mediaType: "application/pdf", prompt: "x" });
    assert.strictEqual(calls1[0].messages[0].content[0].type, "document");

    const { client: c2, calls: calls2 } = makeFakeClient();
    await extraerJsonConVision(c2, { base64: "AAA", mediaType: "image/png", prompt: "x" });
    assert.strictEqual(calls2[0].messages[0].content[0].type, "image");
  });

  test("extraerJsonConVision manda el prompt recibido como segundo bloque de contenido", async () => {
    const { client, calls } = makeFakeClient();
    await extraerJsonConVision(client, { base64: "AAA", mediaType: "image/jpeg", prompt: "MI PROMPT ÚNICO" });
    assert.strictEqual(calls[0].messages[0].content[1].type, "text");
    assert.strictEqual(calls[0].messages[0].content[1].text, "MI PROMPT ÚNICO");
  });

  test("extraerJsonConVision usa SONNET_MODEL por defecto, y max_tokens 1000 por defecto", async () => {
    const { client, calls } = makeFakeClient();
    await extraerJsonConVision(client, { base64: "AAA", mediaType: "image/jpeg", prompt: "x" });
    assert.strictEqual(calls[0].model, SONNET_MODEL);
    assert.strictEqual(calls[0].max_tokens, 1000);
  });

  test("extraerJsonConVision permite sobreescribir model y maxTokens explícitamente", async () => {
    const { client, calls } = makeFakeClient();
    await extraerJsonConVision(client, { base64: "AAA", mediaType: "image/jpeg", prompt: "x", model: "otro-modelo", maxTokens: 42 });
    assert.strictEqual(calls[0].model, "otro-modelo");
    assert.strictEqual(calls[0].max_tokens, 42);
  });

  test("extraerJsonConVision parsea el primer bloque JSON de la respuesta", async () => {
    const { client } = makeFakeClient({ text: 'Aquí tienes: {"nombre":"Ana","curso":"3ESO"} gracias' });
    const result = await extraerJsonConVision(client, { base64: "AAA", mediaType: "image/jpeg", prompt: "x" });
    assert.deepEqual(result, { datos: { nombre: "Ana", curso: "3ESO" } });
  });

  test("extraerJsonConVision -> {error:'no_json'} si la respuesta no tiene JSON", async () => {
    const { client } = makeFakeClient({ text: "No he podido leer la imagen." });
    const result = await extraerJsonConVision(client, { base64: "AAA", mediaType: "image/jpeg", prompt: "x" });
    assert.deepEqual(result, { error: "no_json" });
  });

  test("extraerJsonConVision -> {error:'invalid_json'} si el bloque no es JSON válido", async () => {
    const { client } = makeFakeClient({ text: "{esto no es json}" });
    const result = await extraerJsonConVision(client, { base64: "AAA", mediaType: "image/jpeg", prompt: "x" });
    assert.deepEqual(result, { error: "invalid_json" });
  });

  // ── extraerDatosGasto / extraerDatosInscripcion — wrappers de dominio ────

  test("extraerDatosGasto manda su propio prompt (factura/gasto) y el media_type recibido", async () => {
    const { client, calls } = makeFakeClient({ text: '{"proveedor":"Ferretería X"}' });
    const result = await extraerDatosGasto(client, { base64: "AAA", mediaType: "image/heic" });
    assert.match(calls[0].messages[0].content[1].text, /factura o ticket de gasto/);
    assert.strictEqual(calls[0].messages[0].content[0].source.media_type, "image/heic");
    assert.deepEqual(result, { datos: { proveedor: "Ferretería X" } });
  });

  test("extraerDatosInscripcion manda su propio prompt (ficha de inscripción) y el media_type recibido", async () => {
    const { client, calls } = makeFakeClient({ text: '{"nombre":"Ana"}' });
    const result = await extraerDatosInscripcion(client, { base64: "AAA", mediaType: "image/x-adobe-dng" });
    assert.match(calls[0].messages[0].content[1].text, /ficha de inscripción/);
    assert.strictEqual(calls[0].messages[0].content[0].source.media_type, "image/x-adobe-dng");
    assert.deepEqual(result, { datos: { nombre: "Ana" } });
  });
}
