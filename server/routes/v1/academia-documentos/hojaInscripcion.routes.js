import { makeRequestId } from "../../../lib/requestId.js";
import { fail } from "../../../lib/http.js";
import { requireRole } from "../../../lib/middleware.js";
import { getTenantSlug } from "../../../lib/tenantSlug.js";
import { createSupabaseAdmin } from "../../../lib/supabase.js";
import { makeTenantMembershipGuard } from "../../../lib/security/tenantMembershipGuard.js";
import { construirPayloadHojaInscripcion } from "../../../lib/academiaDocumentos/construirPayloadHojaInscripcion.js";
import { calcularHashHojaInscripcion } from "../../../lib/academiaDocumentos/hashHojaInscripcion.js";
import { leerCacheHojaInscripcion, guardarCacheHojaInscripcion } from "../../../lib/academiaDocumentos/hojaInscripcionCache.js";
import { generarHojaInscripcion } from "../../../lib/academiaDocumentos/generarHojaInscripcion.js";
import { getPdfServiceUrl } from "../../../lib/pdfService/url.js";

const CODES = {
  pdf_service_unreachable: [502, "pdf_service_unreachable"],
  pdf_service_failed: [502, "pdf_service_failed"],
};

function servirPdf(reply, buffer) {
  reply.header("Content-Type", "application/pdf");
  reply.header("Content-Disposition", 'inline; filename="Hoja_inscripcion.pdf"');
  return reply.send(buffer);
}

// GET /api/v1/academia/documentos/hoja-inscripcion — sirve la hoja de
// inscripción del tenant, generándola solo cuando hace falta. El payload
// que alimenta la plantilla (campos activados, texto legal, datos del
// centro) se construye siempre — es una lectura barata a la base de
// datos — y su hash decide si ya existe un PDF en caché en Storage
// (documentos-generados, ver hojaInscripcionCache.js) idéntico al que se
// generaría ahora mismo; si lo hay, se sirve tal cual sin tocar el
// microservicio. Un fallo leyendo el caché degrada a generar en vivo
// (log de warning, nunca un error para el usuario); un fallo guardando
// el PDF recién generado no impide servirlo.
export default async function academiaDocumentosHojaInscripcionRoutes(app) {
  const guard = makeTenantMembershipGuard();

  app.get("/hoja-inscripcion", { preHandler: guard.preHandler }, async (req, reply) => {
    const requestId = req.requestId || makeRequestId();
    const tenantSlug = getTenantSlug(req);
    const auth = await requireRole(req, reply, requestId, { tenantSlug, roles: ["admin"] });
    if (!auth.ok) return;

    const admin = createSupabaseAdmin();
    const payload = await construirPayloadHojaInscripcion(admin, {
      tenantId: auth.tenant.id,
      tenantNombre: auth.tenant.name,
    });
    const hash = calcularHashHojaInscripcion(payload);

    const cache = await leerCacheHojaInscripcion(admin, auth.tenant.id, hash);
    if (cache.ok) return servirPdf(reply, cache.buffer);
    if (cache.error) {
      req.log.warn({ err: cache.error, requestId }, "academia documentos hoja-inscripcion: fallo leyendo caché, se genera en vivo");
    }

    const pdfServiceUrl = getPdfServiceUrl();
    const resultado = await generarHojaInscripcion({ tenantId: auth.tenant.id, payload, pdfServiceUrl });

    if (!resultado.ok) {
      const [status, code] = CODES[resultado.code] || [500, "hoja_inscripcion_failed"];
      req.log.error({ err: resultado, requestId }, "academia documentos hoja-inscripcion failed");
      return fail(reply, status, code, resultado.motivo, requestId);
    }

    const guardado = await guardarCacheHojaInscripcion(admin, auth.tenant.id, hash, resultado.buffer);
    if (!guardado.ok) {
      req.log.warn({ err: guardado.error, requestId }, "academia documentos hoja-inscripcion: fallo guardando en caché, se sirve igual");
    }

    return servirPdf(reply, resultado.buffer);
  });
}
