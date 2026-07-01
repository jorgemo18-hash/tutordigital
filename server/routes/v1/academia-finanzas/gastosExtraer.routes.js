import { z } from "zod";
import { makeRequestId } from "../../../lib/requestId.js";
import { ok, fail } from "../../../lib/http.js";
import { requireRole } from "../../../lib/middleware.js";
import { getTenantSlug } from "../../../lib/tenantSlug.js";
import { makeTenantMembershipGuard } from "../../../lib/security/tenantMembershipGuard.js";
import { getBase64FromMaybeDataUrl, approxBase64Bytes } from "../../../lib/chatValidation.js";
import { extraerDatosGasto } from "../../../lib/academiaFinanzas/gastoExtraccion.js";
import { convertirHeicBase64 } from "../../../lib/academiaFinanzas/heicConverter.js";

const MEDIA_TYPES = ["image/jpeg", "image/png", "image/webp", "application/pdf", "image/heic", "image/heif", "image/x-adobe-dng", "image/dng"];
const MAX_BYTES = 31_457_280; // 30 MB — igual que el bodyLimit global de Fastify
const MAX_OCR_BYTES = 5_242_880; // 5 MB — límite del OCR tras convertir, más estricto que el bodyLimit global
const ExtraerBodySchema = z.object({
  base64: z.string().min(1),
  mediaType: z.enum(MEDIA_TYPES),
});

// POST /api/v1/academia/finanzas/gastos/extraer — OCR con visión de una
// factura/ticket de gasto (foto JPG/PNG o PDF). Mismo patrón que
// academia.inscripciones.routes.js (base64 en JSON, sin multipart), con
// su propio prompt/categorías en academiaFinanzas/gastoExtraccion.js.
export default async function academiaFinanzasGastosExtraerRoutes(app) {
  const guard = makeTenantMembershipGuard();

  app.post("/extraer", { preHandler: guard.preHandler }, async (req, reply) => {
    const requestId = req.requestId || makeRequestId();
    const tenantSlug = getTenantSlug(req);
    const auth = await requireRole(req, reply, requestId, { tenantSlug, roles: ["admin"] });
    if (!auth.ok) return;

    const parsed = ExtraerBodySchema.safeParse(req.body || {});
    if (!parsed.success) return fail(reply, 400, "invalid_body", "Invalid body", requestId, { issues: parsed.error.issues });

    const base64Raw = getBase64FromMaybeDataUrl(parsed.data.base64);
    if (!base64Raw) return fail(reply, 400, "invalid_base64", "Archivo inválido.", requestId);
    if (approxBase64Bytes(base64Raw) > MAX_BYTES) {
      return fail(reply, 413, "payload_too_large", "El archivo supera los 30MB permitidos.", requestId);
    }
    // Comprobar el límite del OCR sobre el archivo ORIGINAL, antes de
    // convertir — un DNG/HEIC grande puede tardar minutos en convertirse con
    // sharp, y eso no sirve de nada si igualmente va a superar el límite.
    if (approxBase64Bytes(base64Raw) > MAX_OCR_BYTES) {
      return fail(reply, 422, "file_too_large", "El archivo supera los 5MB.", requestId);
    }

    // HEIC/HEIF/DNG no son soportados por la API de visión — convertir a JPEG.
    // Si el servidor no tiene soporte RAW para DNG, el converter lanza un error
    // con mensaje claro que se devuelve al cliente como 422.
    let base64, mediaType;
    try {
      ({ base64, mediaType } = await convertirHeicBase64(base64Raw, parsed.data.mediaType));
    } catch (err) {
      return fail(reply, 422, "conversion_failed", err.message, requestId);
    }

    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) return fail(reply, 500, "missing_key", "AI service not configured", requestId);

    try {
      const { datos, error } = await extraerDatosGasto(apiKey, { base64, mediaType });
      if (error) {
        console.error("academia finanzas gastos ocr: extraction failed", { requestId, error });
        req.log.error({ requestId, error }, "academia finanzas gastos ocr: extraction failed");
        return fail(reply, 422, "ocr_failed", "No se pudieron extraer los datos", requestId);
      }
      return ok(reply, datos, requestId);
    } catch (err) {
      // No dejar que un error del SDK de Anthropic (red, rate limit, respuesta
      // inesperada...) tumbe la request con un 500 — se loggea completo para
      // poder diagnosticarlo y se devuelve un 422 manejable por el cliente.
      console.error("academia finanzas gastos ocr failed", err);
      req.log.error({ err, requestId }, "academia finanzas gastos ocr failed");
      return fail(reply, 422, "ocr_failed", "No se pudieron extraer los datos", requestId);
    }
  });
}
