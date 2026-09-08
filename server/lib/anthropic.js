import Anthropic from "@anthropic-ai/sdk";

// Punto único de creación del cliente Anthropic — antes había 7 instancias
// independientes (chat.js, guide.js x2, gastoExtraccion.js,
// generarComentario.js, academia.inscripciones.routes.js, reports.routes.js),
// cada una con su propio `new Anthropic({apiKey})` y nombres de modelo
// hardcodeados sin una única fuente de verdad (reports.routes.js seguía en
// claude-opus-4-6 mientras el resto ya usaba 4-8 — corregido junto con esto).
export function createAnthropicClient(apiKey) {
  return new Anthropic({ apiKey });
}

export const OPUS_MODEL = "claude-opus-4-8";
export const SONNET_MODEL = "claude-sonnet-4-6";

// EL MODELO NO LO ELIGE QUIEN LLAMA (auditoría del 08/09/2026).
//
// El cuerpo del chat admitía un campo `model` y se usaba tal cual: quien
// llamara decidía con qué modelo se le respondía y, por tanto, cuánto costaba
// cada mensaje. Ningún cliente de la app manda ese campo —comprobado, no
// aparece en assets/—, así que en la práctica solo servía para que alguien de
// fuera pidiera el modelo más caro que existiera y lo pagara la academia.
//
// Se resolvió ignorándolo, no filtrándolo con una lista blanca: una lista hay
// que mantenerla, y el día que se añada un modelo caro alguien lo meterá ahí
// sin pensar en que eso reabre la puerta. El modelo sale del servidor
// (ANTHROPIC_MODEL) y punto.
