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
import { temasConReferencias, cursosConReferencias } from "../../../lib/ejerciciosReferencia/referencias.js";
import { generaHojaIA } from "../../../lib/hojasIA/generaHojaIA.js";

// HOJAS ESCRITAS POR LA IA (fase 3), para los temas que tienen ejercicios de
// referencia y no tienen generador propio (server/lib/hojasIA/).
//   GET  /ia/disponibles                    etapas, materias y cursos con referencias
//   GET  /ia/temas?etapa=&materia=&curso=   los temas que se pueden pedir
//   POST /ia/generar { etapa, materia, curso, tema, actividades?, dificultad? }
// Como el pedido en palabras, gasta dinero: límite por usuario y el consumo
// va a ai_token_usage con su `source` (migración 149).
export const SOURCE = "hojas_ia";
export const LIMITE_POR_MINUTO = 6;
const nombre = z.string().regex(/^[a-z0-9-]+$/).max(80);

const Donde = z.object({
  etapa: z.enum(["primaria", "eso", "bachillerato"]),
  materia: nombre,
  curso: z.coerce.number().int().min(1).max(6),
});
export const GenerarIASchema = Donde.extend({
  tema: nombre,
  actividades: z.number().int().min(1).max(10).optional(),
  dificultad: z.number().int().min(1).max(3).nullable().optional(),
});

export function crearRutasDeHojasIA({ roles, clientFn = createAnthropicClient, adminFn = createSupabaseAdmin }) {
  return async function rutasDeHojasIA(app) {
    const guard = makeTenantMembershipGuard();

    app.get("/ia/disponibles", { preHandler: guard.preHandler }, async (req, reply) => {
      const requestId = req.requestId || makeRequestId();
      const auth = await requireRole(req, reply, requestId, { tenantSlug: getTenantSlug(req), roles });
      if (!auth.ok) return;
      return ok(reply, { cursos: cursosConReferencias() }, requestId);
    });

    app.get("/ia/temas", { preHandler: guard.preHandler }, async (req, reply) => {
      const requestId = req.requestId || makeRequestId();
      const auth = await requireRole(req, reply, requestId, { tenantSlug: getTenantSlug(req), roles });
      if (!auth.ok) return;
      const q = Donde.safeParse(req.query || {});
      if (!q.success) return fail(reply, 400, "invalid_query", "Invalid query", requestId);
      return ok(reply, { temas: temasConReferencias(q.data) }, requestId);
    });

    app.post("/ia/generar", { preHandler: guard.preHandler }, async (req, reply) => {
      const requestId = req.requestId || makeRequestId();
      const auth = await requireRole(req, reply, requestId, { tenantSlug: getTenantSlug(req), roles });
      if (!auth.ok) return;
      const rl = await rateLimit(req, { limit: LIMITE_POR_MINUTO, windowSec: 60, userId: auth.user.id, tenantId: auth.tenant.id });
      if (!rl.ok) return fail(reply, 429, "rate_limited", "Demasiadas peticiones seguidas. Espera un minuto.", requestId);
      const p = GenerarIASchema.safeParse(req.body || {});
      if (!p.success) return fail(reply, 400, "invalid_body", "Invalid body", requestId, { issues: p.error.issues });
      const apiKey = process.env.ANTHROPIC_API_KEY;
      if (!apiKey) return fail(reply, 503, "ia_no_configurada", "La IA no está configurada", requestId);
      try {
        const r = await generaHojaIA({
          client: clientFn(apiKey), model: SONNET_MODEL, ...p.data, cuantos: p.data.actividades || 6,
        });
        if (!r) return fail(reply, 404, "tema_sin_referencias", "Ese tema no tiene ejercicios de referencia", requestId);
        recordTokenUsage({ admin: adminFn(), tenantId: auth.tenant.id, source: SOURCE, model: SONNET_MODEL, usage: r.usage }).catch(() => {});
        if (r.descartes.length) req.log.info({ requestId, descartes: r.descartes }, "hojas IA: ejercicios descartados por la comprobación");
        if (!r.hoja.actividades.length) return fail(reply, 502, "ia_sin_ejercicios", "La IA no ha escrito ningún ejercicio que pase la comprobación. Prueba otra vez.", requestId);
        return ok(reply, { hoja: r.hoja, huecos: r.huecos, descartados: r.descartes.length }, requestId);
      } catch (err) {
        req.log.error({ err, requestId }, "hojas IA: fallo al generar");
        return fail(reply, 502, "ia_fallo", "La IA no ha respondido. Prueba otra vez.", requestId);
      }
    });
  };
}
