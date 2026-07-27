// Persistencia de consumo real de tokens por tenant (ai_token_usage, ver
// migración 100). Fire-and-forget real: los call sites la invocan SIN
// await — nunca debe añadir latencia perceptible a la respuesta del alumno
// ni romper el streaming. Sin reintento (a diferencia de session_messages
// en chatHandler.js): esto es coste/analítica, no historial que el alumno
// vea — perder una fila suelta es aceptable a cambio de no añadir una
// segunda ronda de complejidad.
//
// Un fallo AQUÍ nunca debe tumbar la petición — todo vive dentro de un
// único try/catch y la función nunca lanza. Pero tampoco puede quedar
// silencioso del todo: un fallo sistemático (esquema cambiado, credencial
// rotada, rate limit) dejaría la base de coste incompleta sin que nadie lo
// note, y el panel de superadmin va a fijar precio sobre estos números —
// por eso se enruta a Sentry en vez de solo console.error, para no
// depender de que alguien lea los logs de Render.
import { computeCostUsd, currentFxUsdEur } from "./aiPricing.js";
import { Sentry } from "./sentry.js";

// `admin` como parámetro explícito, no instanciado dentro de la función:
// los 4 call sites (chatHandler.js, chat.routes.js, sessionLifecycle.js,
// exerciseSelection.js) ya tienen su propio cliente creado — reutilizarlo
// evita una instancia redundante por mensaje y hace esta función testeable
// con un fake sin credenciales reales, mismo criterio que
// resolverAlumnoIdsVisibles/fetchEstadoActual (dependencias explícitas, no
// cerrar sobre createSupabaseAdmin()).
export async function recordTokenUsage({ admin, tenantId, sessionId = null, source, model, usage }) {
  // Sin tenant no hay a quién atribuir el gasto; sin usage (p.ej. una rama
  // de error de la llamada a Claude) no hay nada que guardar — no es un
  // fallo, es un no-op esperado.
  if (!tenantId || !usage) return;

  const inputTokens  = usage.input_tokens  || 0;
  const outputTokens = usage.output_tokens || 0;
  const cacheCreationTokens = usage.cache_creation_input_tokens || 0;
  const cacheReadTokens     = usage.cache_read_input_tokens     || 0;

  // Coste exacto en USD (la moneda real de la factura de Anthropic) + el
  // tipo de cambio vigente AHORA, congelado en esta fila — el EUR se deriva
  // de los dos al leer (ver usdToEur en aiPricing.js y sumTokenUsage en
  // superadmin.stats.routes.js), nunca se guarda directamente.
  const costUsd = computeCostUsd({
    model, inputTokens, outputTokens,
    cacheCreationTokens, cacheReadTokens,
  });
  const fxUsdEur = currentFxUsdEur();

  try {
    const { error } = await admin.from("ai_token_usage").insert({
      tenant_id:  tenantId,
      session_id: sessionId,
      source,
      model,
      input_tokens:  inputTokens,
      output_tokens: outputTokens,
      cache_creation_input_tokens: cacheCreationTokens,
      cache_read_input_tokens:     cacheReadTokens,
      cost_usd: costUsd,
      fx_usd_eur: fxUsdEur,
    });

    if (error) {
      console.error("[tokenUsage] insert failed", { tenantId, source, model, error: error.message });
      Sentry.captureMessage("ai_token_usage insert failed", {
        level: "warning",
        extra: { tenantId, sessionId, source, model, errorCode: error.code, errorMessage: error.message },
      });
    }
  } catch (err) {
    console.error("[tokenUsage] unexpected error", { tenantId, source, model, err: err?.message });
    Sentry.captureException(err, {
      extra: { operation: "record_token_usage", tenantId, sessionId, source, model },
    });
  }
}
