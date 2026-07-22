import { z } from "zod";
import { makeRequestId } from "../../../lib/requestId.js";
import { ok, fail } from "../../../lib/http.js";
import { requireRole } from "../../../lib/middleware.js";
import { getTenantSlug } from "../../../lib/tenantSlug.js";
import { createSupabaseAdmin } from "../../../lib/supabase.js";
import { makeTenantMembershipGuard } from "../../../lib/security/tenantMembershipGuard.js";
import { enviarReciboYInformesDeFamilia } from "../../../lib/academiaEnvio/enviarFamiliaEmail.js";

const ParamsSchema = z.object({ familia_id: z.string().uuid() });
const BodySchema = z.object({
  mes: z.coerce.number().int().min(1).max(12),
  anio: z.coerce.number().int().min(2000).max(2100),
  tipo: z.enum(["completo", "solo_recibo", "solo_informe"]).optional().default("completo"),
  confirmar: z.boolean().optional().default(false),
});

export default async function academiaRecibosEnviarRoutes(app) {
  const guard = makeTenantMembershipGuard();

  // POST /api/v1/academia/recibos/familia/:familia_id/enviar — envío por
  // familia con el tipo elegido en el diálogo de "Enviar" (recibo+
  // informes, solo recibo, o solo informe(s) — ver enviarFamiliaEmail.js,
  // que resuelve internamente qué recibo/informes existen ese período. Por
  // familia+período, no por recibo: así cubre también "solo informe(s)"
  // de una familia que todavía no tiene recibo generado ese mes.
  // Sustituye a los antiguos /:id/enviar (por recibo) y /enviar-todos (que
  // solo cubría recibos en borrador, sin tipo) — el lote ahora lo decide
  // el frontend familia a familia (ver envioFamiliasSection.js).
  app.post("/familia/:familia_id/enviar", { preHandler: guard.preHandler }, async (req, reply) => {
    const requestId = req.requestId || makeRequestId();
    const tenantSlug = getTenantSlug(req);
    const auth = await requireRole(req, reply, requestId, { tenantSlug, roles: ["admin"] });
    if (!auth.ok) return;

    const parsedParams = ParamsSchema.safeParse(req.params || {});
    if (!parsedParams.success) return fail(reply, 400, "invalid_params", "Invalid params", requestId);
    const parsedBody = BodySchema.safeParse(req.body || {});
    if (!parsedBody.success) return fail(reply, 400, "invalid_body", "Invalid body", requestId, { issues: parsedBody.error.issues });

    const admin = createSupabaseAdmin();
    const tenantId = auth.tenant.id;
    const pdfServiceUrl = process.env.PDF_SERVICE_URL || "http://localhost:3002";
    const resultado = await enviarReciboYInformesDeFamilia(admin, {
      tenantId,
      familiaId: parsedParams.data.familia_id,
      tenantNombre: auth.tenant.name,
      pdfServiceUrl,
      mes: parsedBody.data.mes,
      anio: parsedBody.data.anio,
      tipoEnvio: parsedBody.data.tipo,
      confirmar: parsedBody.data.confirmar,
    });

    if (!resultado.ok) {
      if (resultado.code === "requiere_confirmacion") {
        return fail(reply, 409, "requiere_confirmacion", resultado.motivo, requestId, { afectados: resultado.afectados });
      }
      if (resultado.code === "not_found") return fail(reply, 404, "familia_not_found", resultado.motivo, requestId);
      if (resultado.code === "sin_email") return fail(reply, 422, "familia_sin_email", resultado.motivo, requestId);
      if (resultado.code === "sin_contenido") return fail(reply, 422, "sin_contenido", resultado.motivo, requestId);
      req.log.error({ err: resultado, requestId }, "academia recibos enviar-familia failed");
      return fail(reply, 500, "recibo_enviar_failed", resultado.motivo, requestId);
    }
    return ok(reply, { enviado: true, reciboAdjuntado: resultado.reciboAdjuntado, informesAdjuntados: resultado.informesAdjuntados }, requestId);
  });
}
