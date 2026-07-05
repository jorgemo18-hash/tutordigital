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
