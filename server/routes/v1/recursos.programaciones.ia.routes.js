import { z } from "zod";
import { makeRequestId } from "../../lib/requestId.js";
import { ok, fail } from "../../lib/http.js";
import { requireRole } from "../../lib/middleware.js";
import { getTenantSlug } from "../../lib/tenantSlug.js";
import { rateLimit } from "../../lib/rateLimit.js";
import { makeTenantMembershipGuard } from "../../lib/security/tenantMembershipGuard.js";
import { createSupabaseAdmin } from "../../lib/supabase.js";
import { createAnthropicClient, SONNET_MODEL } from "../../lib/anthropic.js";
import { recordTokenUsage } from "../../lib/tokenUsage.js";
import { curriculoDeCurso } from "../../lib/curriculo/curriculoAragon.js";
import { deLaVariante } from "../../../assets/shared/programacion/estructuraDeLaProgramacion.js";
import { DatosSchema } from "../../lib/programaciones/programaciones.js";
import { proponUnidades } from "../../lib/programaciones/ia/proponUnidades.js";
import { redactaTextos, LETRAS_DE_TEXTO } from "../../lib/programaciones/ia/redactaTextos.js";

// RECURSOS → PROGRAMACIÓN, EL BORRADOR CON IA (migración 132 para el gasto).
//   POST /unidades  { materia_slug, curso, variante?, sesionesTotales }
//   POST /textos    { materia_slug, curso, datos, letras }
// No guardan nada: devuelven la propuesta y el panel la aplica (y la guarda
// con el guardado automático de siempre). Son las únicas rutas de
// Programación que gastan dinero, así que llevan límite por usuario y el
// consumo va a ai_token_usage con su `source`.
export const ROLES = ["teacher", "admin"];
export const LIMITE_POR_MINUTO = 6;

const Base = {
  materia_slug: z.string().regex(/^[a-z0-9-]+$/).max(80),
  curso: z.number().int().min(1).max(4).nullable(),
  variante: z.string().max(200).nullable().optional(),
};
const PideUnidades = z.object({ ...Base, sesionesTotales: z.number().int().min(0).max(900) });
const PideTextos = z.object({
  ...Base,
  datos: DatosSchema,
  letras: z.array(z.enum(LETRAS_DE_TEXTO)).min(1).max(LETRAS_DE_TEXTO.length),
});

export function crearRutasDeProgramacionIA({ clientFn = createAnthropicClient, adminFn = createSupabaseAdmin } = {}) {
  return async function recursosProgramacionesIARoutes(app) {
    const guard = makeTenantMembershipGuard();

    // Lo común: quién, cuánto, qué pide y si hay IA. Devuelve null si ya ha
    // respondido.
    async function prepara(req, reply, Esquema) {
      const requestId = req.requestId || makeRequestId();
      const auth = await requireRole(req, reply, requestId, { tenantSlug: getTenantSlug(req), roles: ROLES });
      if (!auth.ok) return null;
      const rl = await rateLimit(req, { limit: LIMITE_POR_MINUTO, windowSec: 60, userId: auth.user.id, tenantId: auth.tenant.id });
      if (!rl.ok) { fail(reply, 429, "rate_limited", "Demasiadas peticiones seguidas. Espera un minuto.", requestId); return null; }
      const p = Esquema.safeParse(req.body || {});
      if (!p.success) { fail(reply, 400, "invalid_body", "Invalid body", requestId, { issues: p.error.issues }); return null; }
      const completo = curriculoDeCurso(p.data.materia_slug, p.data.curso);
      if (!completo) { fail(reply, 404, "materia_no_encontrada", "Esa materia no está en el currículo", requestId); return null; }
      const apiKey = process.env.ANTHROPIC_API_KEY;
      if (!apiKey) { fail(reply, 503, "ia_no_configurada", "La IA no está configurada", requestId); return null; }
      return { requestId, auth, datos: p.data, curriculo: deLaVariante(completo, p.data.variante), client: clientFn(apiKey) };
    }
    const apunta = (auth, source, usage) => recordTokenUsage({
      admin: adminFn(), tenantId: auth.tenant.id, source, model: SONNET_MODEL, usage,
    }).catch(() => {});

    app.post("/unidades", { preHandler: guard.preHandler }, async (req, reply) => {
      const c = await prepara(req, reply, PideUnidades);
      if (!c) return;
      try {
        const r = await proponUnidades({
          client: c.client, model: SONNET_MODEL, curriculo: c.curriculo, curso: c.datos.curso, sesionesTotales: c.datos.sesionesTotales,
        });
        apunta(c.auth, "programacion_unidades", r.usage);
        if (!r.unidades.length) return fail(reply, 502, "ia_sin_propuesta", "La IA no ha propuesto unidades. Prueba otra vez.", c.requestId);
        req.log.info({ requestId: c.requestId, arreglos: r.arreglos }, "programación: unidades propuestas por la IA");
        return ok(reply, { unidades: r.unidades, arreglos: r.arreglos }, c.requestId);
      } catch (err) {
        req.log.error({ err, requestId: c.requestId }, "programación: fallo al proponer unidades");
        return fail(reply, 502, "ia_fallo", "La IA no ha respondido. Prueba otra vez.", c.requestId);
      }
    });

    app.post("/textos", { preHandler: guard.preHandler }, async (req, reply) => {
      const c = await prepara(req, reply, PideTextos);
      if (!c) return;
      try {
        const r = await redactaTextos({
          client: c.client, model: SONNET_MODEL, curriculo: { ...c.curriculo, curso: c.datos.curso }, datos: c.datos.datos, letras: c.datos.letras,
        });
        apunta(c.auth, "programacion_textos", r.usage);
        return ok(reply, { textos: r.textos }, c.requestId);
      } catch (err) {
        req.log.error({ err, requestId: c.requestId }, "programación: fallo al redactar");
        return fail(reply, 502, "ia_fallo", "La IA no ha respondido. Prueba otra vez.", c.requestId);
      }
    });
  };
}

export default crearRutasDeProgramacionIA();
