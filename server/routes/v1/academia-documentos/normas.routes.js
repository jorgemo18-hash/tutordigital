import { z } from "zod";
import { makeRequestId } from "../../../lib/requestId.js";
import { ok, fail } from "../../../lib/http.js";
import { rateLimit } from "../../../lib/rateLimit.js";
import { requireRole } from "../../../lib/middleware.js";
import { getTenantSlug } from "../../../lib/tenantSlug.js";
import { createSupabaseAdmin } from "../../../lib/supabase.js";
import { makeTenantMembershipGuard } from "../../../lib/security/tenantMembershipGuard.js";
import { subirNormas, obtenerUrlNormas, ALLOWED_NORMAS_MIMES } from "../../../lib/academiaDocumentos/normas.js";

const UploadBodySchema = z.object({
  base64: z.string().min(1),
  mime: z.enum([...ALLOWED_NORMAS_MIMES]),
});

const STATUS_POR_CODIGO = {
  payload_too_large: 413,
  unsupported_mime: 415,
  invalid_base64: 400,
  not_found: 404,
  signed_url_failed: 500,
};

// POST /api/v1/academia/documentos/normas — sube (o reemplaza) el
// documento de normas propio del centro (PDF o DOCX, sin multipart, igual
// patrón base64-en-JSON que academia/config/upload-logo).
// GET  /api/v1/academia/documentos/normas — URL firmada de descarga
// (60min) del documento ya subido, o 404 si no hay ninguno todavía —
// documentosSection.js usa el 404 para decidir "Subir normas" vs.
// "Ver normas" / "Reemplazar".
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
    const resultado = await subirNormas(admin, auth.tenant.id, { base64Input: parsed.data.base64, mime: parsed.data.mime });
    if (!resultado.ok) {
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
    const resultado = await obtenerUrlNormas(admin, auth.tenant.id);
    if (!resultado.ok) {
      return fail(reply, STATUS_POR_CODIGO[resultado.code] || 500, resultado.code, resultado.motivo, requestId);
    }
    return ok(reply, { url: resultado.url, mime: resultado.mime, updatedAt: resultado.updatedAt }, requestId);
  });
}
