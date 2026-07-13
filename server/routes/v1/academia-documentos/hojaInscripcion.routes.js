import { makeRequestId } from "../../../lib/requestId.js";
import { fail } from "../../../lib/http.js";
import { requireRole } from "../../../lib/middleware.js";
import { getTenantSlug } from "../../../lib/tenantSlug.js";
import { createSupabaseAdmin } from "../../../lib/supabase.js";
import { makeTenantMembershipGuard } from "../../../lib/security/tenantMembershipGuard.js";
import { generarHojaInscripcion } from "../../../lib/academiaDocumentos/generarHojaInscripcion.js";

const CODES = {
  pdf_service_unreachable: [502, "pdf_service_unreachable"],
  pdf_service_failed: [502, "pdf_service_failed"],
};

// GET /api/v1/academia/documentos/hoja-inscripcion — genera (en el momento,
// sin guardar nada) la hoja de inscripción en blanco del tenant y devuelve
// el PDF directamente para que el navegador lo abra en una pestaña nueva.
export default async function academiaDocumentosHojaInscripcionRoutes(app) {
  const guard = makeTenantMembershipGuard();

  app.get("/hoja-inscripcion", { preHandler: guard.preHandler }, async (req, reply) => {
    const requestId = req.requestId || makeRequestId();
    const tenantSlug = getTenantSlug(req);
    const auth = await requireRole(req, reply, requestId, { tenantSlug, roles: ["admin"] });
    if (!auth.ok) return;

    const pdfServiceUrl = process.env.PDF_SERVICE_URL || "http://localhost:3002";
    const admin = createSupabaseAdmin();
    const resultado = await generarHojaInscripcion(admin, {
      tenantId: auth.tenant.id,
      tenantNombre: auth.tenant.name,
      pdfServiceUrl,
    });

    if (!resultado.ok) {
      const [status, code] = CODES[resultado.code] || [500, "hoja_inscripcion_failed"];
      req.log.error({ err: resultado, requestId }, "academia documentos hoja-inscripcion failed");
      return fail(reply, status, code, resultado.motivo, requestId);
    }

    reply.header("Content-Type", "application/pdf");
    reply.header("Content-Disposition", 'inline; filename="Hoja_inscripcion.pdf"');
    return reply.send(resultado.buffer);
  });
}
