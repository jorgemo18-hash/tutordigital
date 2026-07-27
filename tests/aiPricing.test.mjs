// aiPricing.js: precios reales de Claude API (fuente en el propio archivo)
// y el cálculo de coste que tokenUsage.js congela por fila en ai_token_usage
// — USD exacto (computeCostUsd) + tipo de cambio del momento
// (currentFxUsdEur), nunca un EUR calculado y guardado directamente (ver
// migración 101_ai_token_usage_moneda: cost_eur se eliminó a propósito).
export async function run({ test, assert }) {
  const { priceForModel, computeCostUsd, currentFxUsdEur, usdToEur } = await import("../server/lib/aiPricing.js");

  test("priceForModel: modelo conocido devuelve su tabla de precios", () => {
    assert.ok(priceForModel("claude-sonnet-4-6"));
    assert.ok(priceForModel("claude-opus-4-8"));
  });

  test("priceForModel: modelo desconocido -> null, nunca un precio inventado", () => {
    assert.equal(priceForModel("claude-modelo-que-no-existe"), null);
  });

  test("computeCostUsd: modelo desconocido -> null (nunca se inventa ni se aproxima con otro modelo)", () => {
    const cost = computeCostUsd({ model: "claude-futuro-sin-precio", inputTokens: 1000, outputTokens: 500 });
    assert.equal(cost, null);
  });

  test("computeCostUsd: sonnet sin caché — solo input+output al precio base, en USD sin conversión", () => {
    const cost = computeCostUsd({ model: "claude-sonnet-4-6", inputTokens: 1_000_000, outputTokens: 1_000_000 });
    // 1M input a $3 + 1M output a $15 = $18 USD exactos, sin tocar EUR
    assert.equal(cost, 18);
  });

  test("computeCostUsd: lectura de caché cuesta menos que input normal (multiplicador 0.1x)", () => {
    const sinCache = computeCostUsd({ model: "claude-sonnet-4-6", inputTokens: 1_000_000, outputTokens: 0 });
    const conCacheRead = computeCostUsd({ model: "claude-sonnet-4-6", inputTokens: 0, outputTokens: 0, cacheReadTokens: 1_000_000 });
    assert.ok(conCacheRead < sinCache, "1M de cache_read debe costar menos que 1M de input normal");
    assert.ok(conCacheRead > 0, "cache_read no es gratis");
  });

  test("computeCostUsd: escritura de caché cuesta más que input normal (multiplicador 1.25x, 5m)", () => {
    const sinCache = computeCostUsd({ model: "claude-sonnet-4-6", inputTokens: 1_000_000, outputTokens: 0 });
    const conCacheWrite = computeCostUsd({ model: "claude-sonnet-4-6", inputTokens: 0, outputTokens: 0, cacheCreationTokens: 1_000_000 });
    assert.ok(conCacheWrite > sinCache, "1M de cache_creation debe costar más que 1M de input normal");
  });

  test("computeCostUsd: sin tokens -> 0, no null (modelo sí conocido, simplemente no hay consumo)", () => {
    const cost = computeCostUsd({ model: "claude-sonnet-4-6", inputTokens: 0, outputTokens: 0 });
    assert.equal(cost, 0);
  });

  test("computeCostUsd: opus es más caro que sonnet para el mismo volumen de tokens", () => {
    const sonnet = computeCostUsd({ model: "claude-sonnet-4-6", inputTokens: 100_000, outputTokens: 50_000 });
    const opus   = computeCostUsd({ model: "claude-opus-4-8",   inputTokens: 100_000, outputTokens: 50_000 });
    assert.ok(opus > sonnet);
  });

  test("currentFxUsdEur: devuelve un número positivo (el tipo de cambio configurado)", () => {
    const fx = currentFxUsdEur();
    assert.equal(typeof fx, "number");
    assert.ok(fx > 0);
  });

  test("usdToEur: conversión pura con el fx que se le pase, nunca uno propio", () => {
    assert.equal(usdToEur(10, 0.9), 9);
    assert.equal(usdToEur(10, 0.5), 5);
  });

  test("usdToEur: costUsd o fx null -> null, nunca fabrica un 0", () => {
    assert.equal(usdToEur(null, 0.9), null);
    assert.equal(usdToEur(10, null), null);
  });

  test("usdToEur: el mismo cost_usd con un fx distinto da un resultado distinto — congelar fx por fila importa de verdad", () => {
    const historico = usdToEur(100, 0.85); // fx de hace un año, por ejemplo
    const hoy       = usdToEur(100, 0.95); // fx de hoy, distinto
    assert.notEqual(historico, hoy);
  });
}
