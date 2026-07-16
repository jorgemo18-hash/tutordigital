import { z } from "zod";
import { makeRequestId } from "../../../lib/requestId.js";
import { ok, fail } from "../../../lib/http.js";
import { rateLimit } from "../../../lib/rateLimit.js";
import { requireRole } from "../../../lib/middleware.js";
import { getTenantSlug } from "../../../lib/tenantSlug.js";
import { createSupabaseAdmin } from "../../../lib/supabase.js";
import { makeTenantMembershipGuard } from "../../../lib/security/tenantMembershipGuard.js";
import { Sentry } from "../../../lib/sentry.js";
import { obtenerMetadataNormas, descargarArchivoNormas, ALLOWED_NORMAS_MIMES } from "../../../lib/academiaDocumentos/normas.js";
import { subirNormasConConversion } from "../../../lib/academiaDocumentos/subirNormasConConversion.js";

const UploadBodySchema = z.object({
  base64: z.string().min(1),
  mime: z.enum([...ALLOWED_NORMAS_MIMES]),
});

const STATUS_POR_CODIGO = {
  payload_too_large: 413,
  unsupported_mime: 415,
  invalid_base64: 400,
  not_found: 404,
  download_failed: 500,
  pdf_service_unreachable: 502,
  pdf_service_failed: 502,
};

// POST /api/v1/academia/documentos/normas — sube (o reemplaza) el
// documento de normas propio del centro (PDF o DOCX, sin multipart, igual
// patrón base64-en-JSON que academia/config/upload-logo). Un DOCX se
// convierte a PDF vía el microservicio antes de guardarse — el bucket
// nunca almacena un DOCX subido a partir de este cambio, solo PDF (ver
// subirNormasConConversion.js); un PDF subido se guarda tal cual.
// GET  /api/v1/academia/documentos/normas — metadata (mime, updatedAt) del
// documento ya subido, o 404 si no hay ninguno todavía — normasCard.js usa
// el 404 para decidir "Subir normas" vs. "Ver normas" / "Reemplazar", y el
// mime para decidir si puede previsualizarlo (caso legado: un DOCX subido
// antes de este cambio, nunca migrado automáticamente).
// GET  /api/v1/academia/documentos/normas/archivo — el documento en sí,
// proxied desde Storage (nunca una URL firmada expuesta al frontend).
export default async function academiaDocumentosNormasRoutes(app) {
  const guard = makeTenantMembershipGuard();

  app.post("/normas", { bodyLimit: 14 * 1024 * 1024, preHandler: guard.preHandler }, async (req, reply) => {
    const requestId = req.requestId || makeRequestId();
    const tenantSlug = getTenantSlug(req);
    const auth = await requireRole(req, reply, requestId, { tenantSlug, roles: ["admin"] });
    if (!auth.ok) return;

    const rl = await rateLimit(req, { limit: 20, windowSec: 60, userId: auth.user.id, tenantId: auth.tenant.id });
    reply.header("x-ratelimit-limit", rl.limit);
    reply.header("x-ratelimit-remaining", rl.remaining);
    if (!rl.ok) return fail(reply, 429, "rate_limited", "Too many requests", requestId);

    const parsed = UploadBodySchema.safeParse(req.body || {});
    if (!parsed.success) return fail(reply, 400, "invalid_body", "Invalid body", requestId, { issues: parsed.error.issues });

    const admin = createSupabaseAdmin();
    const pdfServiceUrl = process.env.PDF_SERVICE_URL || "http://localhost:3002";
    const resultado = await subirNormasConConversion(admin, auth.tenant.id, { ...parsed.data, pdfServiceUrl });
    if (!resultado.ok) {
      if (resultado.code === "pdf_service_unreachable" || resultado.code === "pdf_service_failed") {
        Sentry.captureException(new Error(`Error al convertir normas DOCX a PDF: ${resultado.motivo || resultado.code}`), {
          extra: {
            operation: "convertir_normas_docx",
            tenantId: auth.tenant.id,
            code: resultado.code,
            pdfServiceStatus: resultado.pdfServiceStatus,
            pdfServiceBody: resultado.pdfServiceBody,
          },
        });
      }
      return fail(reply, STATUS_POR_CODIGO[resultado.code] || 500, resultado.code, resultado.motivo, requestId);
    }
    return ok(reply, { subido: true }, requestId);
  });

  app.get("/normas", { preHandler: guard.preHandler }, async (req, reply) => {
    const requestId = req.requestId || makeRequestId();
    const tenantSlug = getTenantSlug(req);
    const auth = await requireRole(req, reply, requestId, { tenantSlug, roles: ["admin", "teacher"] });
    if (!auth.ok) return;

    const admin = createSupabaseAdmin();
    const resultado = await obtenerMetadataNormas(admin, auth.tenant.id);
    if (!resultado.ok) {
      return fail(reply, STATUS_POR_CODIGO[resultado.code] || 500, resultado.code, resultado.motivo, requestId);
    }
    return ok(reply, { mime: resultado.mime, updatedAt: resultado.updatedAt }, requestId);
  });

  app.get("/normas/archivo", { preHandler: guard.preHandler }, async (req, reply) => {
    const requestId = req.requestId || makeRequestId();
    const tenantSlug = getTenantSlug(req);
    const auth = await requireRole(req, reply, requestId, { tenantSlug, roles: ["admin", "teacher"] });
    if (!auth.ok) return;

    const admin = createSupabaseAdmin();
    const resultado = await descargarArchivoNormas(admin, auth.tenant.id);
    if (!resultado.ok) {
      return fail(reply, STATUS_POR_CODIGO[resultado.code] || 500, resultado.code, resultado.motivo, requestId);
    }
    reply.header("Content-Type", resultado.mime);
    reply.header("Content-Disposition", "inline");
    return reply.send(resultado.buffer);
  });
}
