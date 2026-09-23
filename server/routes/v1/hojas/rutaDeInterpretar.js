import { z } from "zod";
import { makeRequestId } from "../../../lib/requestId.js";
import { ok, fail } from "../../../lib/http.js";
import { requireRole } from "../../../lib/middleware.js";
import { getTenantSlug } from "../../../lib/tenantSlug.js";
import { rateLimit } from "../../../lib/rateLimit.js";
import { makeTenantMembershipGuard } from "../../../lib/security/tenantMembershipGuard.js";
import { createSupabaseAdmin } from "../../../lib/supabase.js";
import { createAnthropicClient, SONNET_MODEL } from "../../../lib/anthropic.js";
import { recordTokenUsage } from "../../../lib/tokenUsage.js";
import { catalogoDelPanel } from "../../../lib/generadorEjercicios/hojaDelPanel.js";
import { interpretaPedido, MAX_TURNOS } from "../../../lib/generadorEjercicios/interpretePedido.js";
import { Base } from "./rutasDeHojas.js";

// EL PEDIDO EN PALABRAS (fase 2): "hazme dos de restar con paréntesis".
// Toda la lógica y el porqué están en interpretePedido.js; aquí solo la
// puerta: quién puede, cuánto, y apuntar el gasto.
//
// Es la ÚNICA ruta del generador que gasta dinero (una llamada a Claude por
// mensaje), así que lleva límite por usuario y el consumo va a
// ai_token_usage con su propio `source` (migración 128).
export const SOURCE = "hojas_interpretar";
export const LIMITE_POR_MINUTO = 15;

export const InterpretarSchema = z.object({
  // La conversación entera la guarda el navegador y la manda cada vez: el
  // servidor no guarda estado. Turnos cortos, porque son pedidos, no cartas.
  conversacion: z.array(z.object({
    rol: z.enum(["profesor", "asistente"]),
    texto: z.string().trim().min(1).max(600),
  })).min(1).max(MAX_TURNOS * 2),
  contexto: z.object({
    temaId: Base.temaId,
    objetivo: Base.objetivo,
    intensidad: Base.intensidad,
    // Si viene, el profesor está cambiando ESE ejercicio.
    ejercicio: z.object({
      orden: z.number().int().min(1),
      objetivo: Base.objetivo,
      clave: z.string().trim().min(1).max(60),
    }).optional(),
    // Si viene, el profesor quiere AÑADIR un ejercicio al final de la hoja.
    nuevo: z.object({ objetivo: Base.objetivo }).optional(),
  }),
});

export function crearRutaDeInterpretar({ roles }) {
  return async function rutaDeInterpretar(app) {
  const guard = makeTenantMembershipGuard();

  app.post("/interpretar", { preHandler: guard.preHandler }, async (req, reply) => {
    const requestId = req.requestId || makeRequestId();
    const auth = await requireRole(req, reply, requestId, { tenantSlug: getTenantSlug(req), roles });
    if (!auth.ok) return;

    const rl = await rateLimit(req, {
      limit: LIMITE_POR_MINUTO, windowSec: 60, userId: auth.user.id, tenantId: auth.tenant.id,
    });
    reply.header("x-ratelimit-limit", rl.limit);
    reply.header("x-ratelimit-remaining", rl.remaining);
    if (!rl.ok) return fail(reply, 429, "rate_limited", "Demasiadas peticiones seguidas. Espera un minuto.", requestId);

    const parsed = InterpretarSchema.safeParse(req.body || {});
    if (!parsed.success) {
      return fail(reply, 400, "invalid_body", "Invalid body", requestId, { issues: parsed.error.issues });
    }

    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) return fail(reply, 503, "ia_no_configurada", "La IA no está configurada", requestId);

    try {
      const { resultado, usage, rechazo } = await interpretaPedido({
        client: createAnthropicClient(apiKey),
        model: SONNET_MODEL,
        catalogo: catalogoDelPanel(),
        ...parsed.data,
      });
      // Sin await, como en el resto de la app: apuntar el gasto nunca retrasa
      // la respuesta ni la tumba (ver tokenUsage.js).
      recordTokenUsage({
        admin: createSupabaseAdmin(), tenantId: auth.tenant.id, source: SOURCE, model: SONNET_MODEL, usage,
      }).catch(() => {});
      if (rechazo) req.log.warn({ requestId, rechazo }, "hojas de ejercicios: pedido no entendido");
      return ok(reply, resultado, requestId);
    } catch (err) {
      req.log.error({ err, requestId }, "hojas de ejercicios: fallo al interpretar el pedido");
      return fail(reply, 502, "ia_fallo", "La IA no ha respondido. Prueba otra vez o usa los desplegables.", requestId);
    }
  });
}
}
