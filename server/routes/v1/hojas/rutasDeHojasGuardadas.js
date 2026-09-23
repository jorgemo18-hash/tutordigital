import { z } from "zod";
import { makeRequestId } from "../../../lib/requestId.js";
import { ok, fail } from "../../../lib/http.js";
import { requireRole } from "../../../lib/middleware.js";
import { getTenantSlug } from "../../../lib/tenantSlug.js";
import { makeTenantMembershipGuard } from "../../../lib/security/tenantMembershipGuard.js";
import { createSupabaseAdmin } from "../../../lib/supabase.js";
import { guardaHoja, hojasRecientes, abreHoja } from "../../../lib/hojasGuardadas/hojasGuardadas.js";
import { Base } from "./rutasDeHojas.js";
import { MAX_ACTIVIDADES } from "../../../../assets/shared/hoja/js/actividades.js";

// LAS HOJAS GUARDADAS, CON SU CÓDIGO (paso 2 de Recursos, migración 129).
//
//   POST /guardar         la hoja que se va a imprimir → { id, codigo }
//   GET  /recientes       las últimas del profesor, para volver a imprimirlas
//   GET  /guardadas/:id   una hoja del centro, entera
//
// Se guarda lo que manda el panel TAL CUAL se va a imprimir (con los
// cambios sueltos del profesor): es la copia de lo que llega al papel. El
// panel la guarda al pulsar "PDF para imprimir", y si no ha cambiado desde
// la última vez, reutiliza el código en vez de gastar otro.
export const MAX_BYTES = 300 * 1024;

const Hueco = z.object({
  orden: z.number().int().min(1),
  clave: z.string().max(60),
  objetivo: z.number().int(),
}).passthrough();

export const GuardarSchema = z.object({
  hoja: z.object({
    objetivo: z.string().max(300).optional(),
    materia: z.string().max(120).optional(),
    curso: z.string().max(60).optional(),
    tema: z.string().max(200).optional(),
    centro: z.string().max(200).optional(),
    actividades: z.array(z.object({}).passthrough()).min(1).max(MAX_ACTIVIDADES),
  }).passthrough(),
  huecos: z.array(Hueco).max(MAX_ACTIVIDADES),
  parametros: z.object({
    temaId: Base.temaId,
    objetivo: Base.objetivo,
    intensidad: Base.intensidad,
    todoElTema: z.boolean().optional(),
  }),
}).refine((c) => Buffer.byteLength(JSON.stringify(c)) <= MAX_BYTES, "la hoja es demasiado grande");

export function crearRutasDeHojasGuardadas({ roles, adminFn = createSupabaseAdmin }) {
  return async function rutasDeHojasGuardadas(app) {
    const guard = makeTenantMembershipGuard();

    async function autoriza(req, reply) {
      const requestId = req.requestId || makeRequestId();
      const auth = await requireRole(req, reply, requestId, { tenantSlug: getTenantSlug(req), roles });
      return { requestId, auth };
    }

    app.post("/guardar", { preHandler: guard.preHandler }, async (req, reply) => {
      const { requestId, auth } = await autoriza(req, reply);
      if (!auth.ok) return;
      const parsed = GuardarSchema.safeParse(req.body || {});
      if (!parsed.success) {
        return fail(reply, 400, "invalid_body", "Invalid body", requestId, { issues: parsed.error.issues });
      }
      try {
        const guardada = await guardaHoja({
          admin: adminFn(), tenantId: auth.tenant.id, userId: auth.user.id, ...parsed.data,
        });
        return ok(reply, guardada, requestId);
      } catch (err) {
        req.log.error({ err, requestId }, "hojas: no se pudo guardar");
        return fail(reply, 500, "hoja_no_guardada", "No se pudo guardar la hoja", requestId);
      }
    });

    app.get("/recientes", { preHandler: guard.preHandler }, async (req, reply) => {
      const { requestId, auth } = await autoriza(req, reply);
      if (!auth.ok) return;
      try {
        const hojas = await hojasRecientes({ admin: adminFn(), tenantId: auth.tenant.id, userId: auth.user.id });
        return ok(reply, { hojas }, requestId);
      } catch (err) {
        req.log.error({ err, requestId }, "hojas: no se pudieron listar");
        return fail(reply, 500, "hojas_no_listadas", "No se pudieron cargar las hojas recientes", requestId);
      }
    });

    app.get("/guardadas/:id", { preHandler: guard.preHandler }, async (req, reply) => {
      const { requestId, auth } = await autoriza(req, reply);
      if (!auth.ok) return;
      const id = z.string().uuid().safeParse(req.params?.id);
      if (!id.success) return fail(reply, 400, "invalid_id", "Invalid id", requestId);
      try {
        const hoja = await abreHoja({ admin: adminFn(), tenantId: auth.tenant.id, id: id.data });
        if (!hoja) return fail(reply, 404, "hoja_no_encontrada", "Esa hoja no existe en este centro", requestId);
        return ok(reply, hoja, requestId);
      } catch (err) {
        req.log.error({ err, requestId }, "hojas: no se pudo abrir");
        return fail(reply, 500, "hoja_no_abierta", "No se pudo abrir la hoja", requestId);
      }
    });
  };
}
