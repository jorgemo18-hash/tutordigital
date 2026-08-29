import { z } from "zod";
import { makeRequestId } from "../../lib/requestId.js";
import { ok, fail } from "../../lib/http.js";
import { requireRole } from "../../lib/middleware.js";
import { getTenantSlug } from "../../lib/tenantSlug.js";
import { createSupabaseAdmin } from "../../lib/supabase.js";
import { makeTenantMembershipGuard } from "../../lib/security/tenantMembershipGuard.js";
import { convertirHeicBase64 } from "../../lib/academiaStorage/heicConverter.js";
import { getBase64FromMaybeDataUrl, approxBase64Bytes } from "../../lib/chatValidation.js";
import { createAnthropicClient } from "../../lib/anthropic.js";
import { extraerDatosInscripcion } from "../../lib/academiaAlumnoOcr.js";
import { fetchInscripcionesPendientes } from "../../lib/academiaInscripciones/pendientes.js";
import { normalizarDatosInscripcion } from "../../lib/academiaInscripciones/normalizarDatosOcr.js";

const MEDIA_TYPES = ["image/jpeg", "image/png", "image/gif", "image/webp", "image/heic", "image/heif", "image/x-adobe-dng", "image/dng"];
const MAX_OCR_BYTES = 5_242_880; // 5 MB — mismo límite que academia-finanzas/gastosExtraer.routes.js
const ExtraerBodySchema = z.object({
  base64: z.string().min(1),
  mediaType: z.enum(MEDIA_TYPES),
});

// POST /api/v1/academia/inscripciones/extraer — OCR de una ficha de
// inscripción en papel. Llama a Claude directamente desde el backend (sin
// Edge Functions de Supabase, igual que el resto del proyecto). Mismo
// patrón que academia-finanzas/gastosExtraer.routes.js — la extracción en
// sí vive en lib/academiaAlumnoOcr.js.
export default async function academiaInscripcionesRoutes(app) {
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
    // Comprobar el límite del OCR sobre el archivo ORIGINAL, antes de
    // convertir — un DNG/HEIC grande puede tardar minutos en convertirse con
    // sharp, y eso no sirve de nada si igualmente va a superar el límite.
    if (approxBase64Bytes(base64Raw) > MAX_OCR_BYTES) {
      return fail(reply, 422, "file_too_large", "El archivo supera los 5MB.", requestId);
    }

    // HEIC/HEIF/DNG no son soportados por la API de visión — convertir a JPEG.
    // Si el servidor no tiene soporte RAW para DNG, el converter lanza un error
    // con mensaje claro que se devuelve al cliente como 422.
    let base64, mime;
    try {
      ({ base64, mime } = await convertirHeicBase64(base64Raw, parsed.data.mediaType));
    } catch (err) {
      return fail(reply, 422, "conversion_failed", err.message, requestId);
    }

    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) return fail(reply, 500, "missing_key", "AI service not configured", requestId);

    try {
      const client = createAnthropicClient(apiKey);
      const { datos, error } = await extraerDatosInscripcion(client, { base64, mediaType: mime });
      if (error) {
        req.log.error({ requestId, error }, "academia inscripcion ocr: extraction failed");
        return fail(reply, 422, "ocr_failed", "No se pudieron extraer los datos", requestId);
      }
      // El cliente recibe siempre { alumno, familia } ya repartido y con el
      // método de pago traducido, pase lo que pase con la forma exacta que
      // devuelva el modelo (ver normalizarDatosOcr.js).
      return ok(reply, normalizarDatosInscripcion(datos), requestId);
    } catch (err) {
      // No dejar que un error del SDK de Anthropic (red, rate limit, respuesta
      // inesperada...) tumbe la request con un 500 — se loggea completo para
      // poder diagnosticarlo y se devuelve un 422 manejable por el cliente.
      req.log.error({ err, requestId }, "academia inscripcion ocr failed");
      return fail(reply, 422, "ocr_failed", "No se pudieron extraer los datos", requestId);
    }
  });

  // GET /api/v1/academia/inscripciones/pendientes — borradores creados desde
  // OCR (activo=false, fecha_baja=null). Los archivados también tienen
  // activo=false pero SÍ tienen fecha_baja, así que no aparecen aquí.
  app.get("/pendientes", { preHandler: guard.preHandler }, async (req, reply) => {
    const requestId = req.requestId || makeRequestId();
    const tenantSlug = getTenantSlug(req);
    const auth = await requireRole(req, reply, requestId, { tenantSlug, roles: ["admin"] });
    if (!auth.ok) return;

    // Aquí se sumaban también los alumnos ACTIVOS con cuenta de tutor
    // creada que aún no habían entrado al tutor
    // (academia_alumnos_pendientes_confirmacion). Se ha quitado: un alumno
    // matriculado no es una "inscripción pendiente de revisar", y mezclarlo
    // con los borradores hacía que el banner ámbar contara a toda la
    // academia mientras el tutor no estuviera repartido (ver migración 103).
    //
    // La RPC sigue existiendo y sigue siendo la consulta correcta para
    // "quién tiene cuenta y no ha entrado" — cuando haya una pantalla que
    // lo pida, se llama desde ahí, no desde este endpoint.
    const admin = createSupabaseAdmin();
    const { alumnos, error } = await fetchInscripcionesPendientes(admin, auth.tenant.id);
    if (error) {
      req.log.error({ err: error, requestId }, "academia inscripciones pendientes fetch failed");
      return fail(reply, 500, "pendientes_fetch_failed", "Failed to fetch pendientes", requestId, undefined, error);
    }

    return ok(reply, { alumnos }, requestId);
  });
}
