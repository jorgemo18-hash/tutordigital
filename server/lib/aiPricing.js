// Tabla de precios de Claude API — único sitio donde vive esta información
// (no dispersa por rutas). Usada por tokenUsage.js para calcular cost_usd
// en el momento del INSERT (congelado al escribir, no recalculado al leer
// — ver el comentario de cost_usd en la migración 100_ai_token_usage.sql).
//
// Fuente: https://docs.claude.com/en/docs/about-claude/pricing
// Revisado a mano: 2026-07-27. Precios en USD por millón de tokens tal
// cual los publica Anthropic — "Base Input Tokens" / "Output Tokens" /
// "5m Cache Writes" (multiplicador 1.25x sobre input base) / "Cache Hits &
// Refreshes" (multiplicador 0.1x sobre input base). guide.js usa
// cache_control:{type:"ephemeral"} sin `ttl` explícito, que Anthropic
// resuelve al caché de 5 minutos (no el de 1 hora) — por eso se usa aquí
// el multiplicador de 5m, no el de 1h.
//
// Revisar esta tabla cuando Anthropic anuncie un cambio de precios o el
// proyecto suba de versión de modelo (ver SONNET_MODEL/OPUS_MODEL en
// anthropic.js) — un modelo nuevo que no esté aquí no rompe la captura de
// tokens (cost_usd queda NULL, ver tokenUsage.js), pero sí deja de poder
// estimarse su coste hasta que se añada.
const PRICING_USD_PER_MILLION = {
  "claude-sonnet-4-6": { input: 3, output: 15, cacheWrite5m: 3.75, cacheRead: 0.30 },
  "claude-opus-4-8":   { input: 5, output: 25, cacheWrite5m: 6.25, cacheRead: 0.50 },
};

// ── Tipo de cambio USD → EUR ────────────────────────────────────────────
// Anthropic factura en USD — ese es el coste exacto (cost_usd, ver
// computeCostUsd) y nunca necesita revisión. El EUR es SIEMPRE una
// conversión aproximada sobre ese USD real, nunca el dato guardado
// directamente (ver el comentario de la migración 101_ai_token_usage_moneda:
// cost_eur se eliminó a propósito — se deriva de cost_usd * fx_usd_eur al
// leer, con el fx congelado por fila, nunca con el de hoy).
//
// ⚠️ ESTE NÚMERO SE QUEDA DESFASADO CON EL TIEMPO — a diferencia de la tabla
// de precios de arriba (que solo cambia cuando Anthropic anuncia un cambio
// real, un evento discreto y raro), el cambio de divisa fluctúa a diario.
// No hay ninguna alarma automática si se queda desfasado: es
// responsabilidad de quien lea este archivo revisarlo de vez en cuando.
//
// Origen del valor actual: cotización EUR/USD de mercado consultada el
// 2026-07-27 (búsqueda web puntual, ~1.14 USD por EUR → ~0.88 EUR por USD).
// No es un feed en vivo ni una fuente oficial fijada — es una cifra de
// referencia tomada una vez y anotada aquí. Repetir esa misma búsqueda
// (p.ej. "USD to EUR exchange rate") y actualizar este valor + la fecha de
// abajo es la forma de "revisarlo".
//
// Última revisión: 2026-07-27 · valor: 0.88
const USD_TO_EUR = 0.88;

export function priceForModel(model) {
  return PRICING_USD_PER_MILLION[model] || null;
}

// El tipo de cambio vigente AHORA MISMO — tokenUsage.js lo lee una vez por
// llamada y lo guarda tal cual en fx_usd_eur (congelado por fila). Nunca se
// vuelve a llamar para leer una fila ya escrita.
export function currentFxUsdEur() {
  return USD_TO_EUR;
}

// null si el modelo no está en la tabla — nunca se inventa un precio ni se
// usa el de otro modelo como aproximación. Devuelve USD, el coste exacto
// según la tarifa de Anthropic — la conversión a EUR es responsabilidad de
// quien lea la fila (ver usdToEur), nunca de esta función.
export function computeCostUsd({ model, inputTokens = 0, outputTokens = 0, cacheCreationTokens = 0, cacheReadTokens = 0 }) {
  const price = priceForModel(model);
  if (!price) return null;

  const usd =
    (inputTokens / 1_000_000) * price.input +
    (outputTokens / 1_000_000) * price.output +
    (cacheCreationTokens / 1_000_000) * price.cacheWrite5m +
    (cacheReadTokens / 1_000_000) * price.cacheRead;

  // 6 decimales: llamadas individuales cuestan fracciones de céntimo,
  // redondear a 2 decimales aquí perdería toda la precisión útil por fila
  // (el redondeo a céntimos, si hace falta, es cosa de quien sume/muestre).
  return Math.round(usd * 1_000_000) / 1_000_000;
}

// Conversión pura, sin estado — SIEMPRE con el fx que se pasa explícito
// (el congelado en la fila, nunca currentFxUsdEur() aplicado a una fila
// vieja: eso reintroduciría el recálculo retroactivo que todo este diseño
// evita). null si cualquiera de los dos falta, para no fabricar un 0 falso.
export function usdToEur(costUsd, fxUsdEur) {
  if (costUsd == null || fxUsdEur == null) return null;
  return Math.round(costUsd * fxUsdEur * 1_000_000) / 1_000_000;
}
