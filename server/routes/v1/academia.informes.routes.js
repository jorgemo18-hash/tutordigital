import { z } from "zod";
import { makeRequestId } from "../../lib/requestId.js";
import { ok, fail } from "../../lib/http.js";
import { requireRole } from "../../lib/middleware.js";
import { getTenantSlug } from "../../lib/tenantSlug.js";
import { createSupabaseAdmin } from "../../lib/supabase.js";
import { makeTenantMembershipGuard } from "../../lib/security/tenantMembershipGuard.js";
import { enviarInformePorAlumno } from "../../lib/academiaInformes/enviarInforme.js";

const EnviarInformeBodySchema = z.object({
  alumno_id: z.string().uuid(),
  mes: z.coerce.number().int().min(1).max(12),
  anio: z.coerce.number().int().min(2000).max(2100),
});

const CODES = {
  not_found: [404, "alumno_not_found"],
  sin_email: [422, "familia_sin_email"],
  sin_sesiones: [422, "sin_sesiones"],
  comentario_failed: [502, "comentario_failed"],
  pdf_service_unreachable: [502, "pdf_service_unreachable"],
  pdf_service_failed: [502, "pdf_service_failed"],
};

// POST /api/v1/academia/enviar-informe — genera (con IA, si falta) el
// comentario mensual, arma el informe (+ recibo, si existe) en
// tutordigital-pdf-service y lo envía por email a la familia del alumno.
export default async function academiaInformesRoutes(app) {
  const guard = makeTenantMembershipGuard();

  app.post("/enviar-informe", { preHandler: guard.preHandler }, async (req, reply) => {
    const requestId = req.requestId || makeRequestId();
    const tenantSlug = getTenantSlug(req);
    const auth = await requireRole(req, reply, requestId, { tenantSlug, roles: ["admin"] });
    if (!auth.ok) return;

    const parsed = EnviarInformeBodySchema.safeParse(req.body || {});
    if (!parsed.success) return fail(reply, 400, "invalid_body", "Invalid body", requestId, { issues: parsed.error.issues });

    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) return fail(reply, 500, "missing_key", "AI service not configured", requestId);
    const pdfServiceUrl = process.env.PDF_SERVICE_URL || "http://localhost:3002";

    const admin = createSupabaseAdmin();
    const resultado = await enviarInformePorAlumno(admin, {
      tenantId: auth.tenant.id,
      tenantNombre: auth.tenant.name,
      alumnoId: parsed.data.alumno_id,
      mes: parsed.data.mes,
      anio: parsed.data.anio,
      apiKey,
      pdfServiceUrl,
    });

    if (!resultado.ok) {
      const [status, code] = CODES[resultado.code] || [500, "enviar_informe_failed"];
      if (status >= 500) req.log.error({ err: resultado, requestId }, "academia enviar-informe failed");
      return fail(reply, status, code, resultado.motivo, requestId);
    }
    return ok(reply, { enviado: true }, requestId);
  });
}
