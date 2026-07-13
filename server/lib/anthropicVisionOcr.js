// anthropicVisionOcr.js — llamada a Claude con visión + parseo del JSON de
// la respuesta, compartido por cualquier flujo de extracción de datos desde
// una imagen/PDF (gastos, inscripciones...). No sabe nada del dominio: cada
// caller aporta su propio prompt de extracción y decide qué hacer con el
// resultado — ver academiaFinanzas/gastoExtraccion.js y academiaAlumnoOcr.js.
//
// Recibe el cliente Anthropic ya creado (no un apiKey) para poder testearse
// con un cliente falso sin llamar a la API real. El bug que motivó extraer
// este archivo (media_type llegando undefined a Claude por un mismatch de
// clave al leer el resultado de convertirHeicBase64) ocurrió DOS veces —una
// en gastos, corregida; otra en inscripciones, sin corregir hasta ahora—
// porque cada copia inlineaba su propia llamada a messages.create() sin
// ningún test que verificara qué se le mandaba de verdad a Claude.

import { SONNET_MODEL } from "./anthropic.js";

// PDF necesita un content block "document" en vez de "image" — el resto del
// mensaje es idéntico.
function buildVisionContentBlock(base64, mediaType) {
  const type = mediaType === "application/pdf" ? "document" : "image";
  return { type, source: { type: "base64", media_type: mediaType, data: base64 } };
}

export async function extraerJsonConVision(client, { base64, mediaType, prompt, model = SONNET_MODEL, maxTokens = 1000 }) {
  const response = await client.messages.create({
    model,
    max_tokens: maxTokens,
    messages: [
      {
        role: "user",
        content: [buildVisionContentBlock(base64, mediaType), { type: "text", text: prompt }],
      },
    ],
  });

  const text = response.content.find((b) => b.type === "text")?.text || "";
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) return { error: "no_json" };

  try {
    return { datos: JSON.parse(match[0]) };
  } catch {
    return { error: "invalid_json" };
  }
}
