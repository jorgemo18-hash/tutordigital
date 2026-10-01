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

// HOJAS CON IA: Sonnet 5.5, pensando antes de escribir (1/10/2026). En el
// banco de pruebas (scripts/hojas-ia-banco.mjs, 3 temas de 2.º ESO):
//   - claude-sonnet-4-6 sin pensar (lo que había): 3 apartados mal y 3
//     ejercicios tirados; 0,056–0,073 USD por hoja;
//   - claude-sonnet-4-6 pensando: más de 170 s por hoja, inservible;
//   - claude-sonnet-5-5 pensando: 0 apartados mal, 0 tirados; 0,058–0,074
//     USD y 29–45 s (cuesta lo mismo: el modelo nuevo es más barato);
//   - claude-opus-5-5 pensando: igual de bien, el doble de caro.
// Sonnet 5.5 no admite obligar a usar una herramienta: llamadaDeHojaIA.js
// ya va en "auto".
export const HOJAS_IA_MODEL = "claude-sonnet-5-5";

// EL CHAT DEL TUTOR: Sonnet 5.5, sin pensamiento (1/10/2026). Con los 14
// escenarios de `npm run tutor:escenarios`, dos pasadas y el mismo prompt:
//   - claude-sonnet-4-6: 22 de 28 (79 %); dio por bueno un paso con el signo
//     mal en las dos pasadas;
//   - claude-sonnet-5-5: 27 de 28 (96 %); su único fallo, dos preguntas en un
//     mensaje.
// Se pasó tal cual se midió: sin `thinking` y sin `temperature` (la rechaza).
// Es más barato por token (2 $/10 $ frente a 3 $/15 $). Los informes
// mensuales siguen en SONNET_MODEL hasta que se midan aparte.
// Ojo: la variable de entorno ANTHROPIC_MODEL, si está puesta en el servidor,
// manda sobre esto (chat.routes.js).
export const TUTOR_MODEL = "claude-sonnet-5-5";

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
