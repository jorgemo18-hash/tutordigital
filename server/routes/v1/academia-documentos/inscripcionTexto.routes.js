import { z } from "zod";
import { makeRequestId } from "../../../lib/requestId.js";
import { ok, fail } from "../../../lib/http.js";
import { rateLimit } from "../../../lib/rateLimit.js";
import { requireRole } from "../../../lib/middleware.js";
import { getTenantSlug } from "../../../lib/tenantSlug.js";
import { createSupabaseAdmin } from "../../../lib/supabase.js";
import { makeTenantMembershipGuard } from "../../../lib/security/tenantMembershipGuard.js";
import { fetchTextoInscripcion, guardarTextoInscripcion } from "../../../lib/academiaDocumentos/inscripcionTexto.js";
import { extraerTextoDocumento } from "../../../lib/academiaDocumentos/extraerTextoInscripcion.js";

const GuardarBodySchema = z.object({ contenido: z.string().trim() });
const ExtraerBodySchema = z.object({
  base64: z.string().min(1),
  mime: z.enum([
    "application/pdf",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ]),
});

const STATUS_POR_CODIGO = {
  payload_too_large: 413,
  unsupported_mime: 415,
  invalid_base64: 400,
  extraction_failed: 422,
  empty_extraction: 422,
};

// Texto de protección de datos de la cara trasera de la hoja de
// inscripción (pestaña Ajustes › Inscripción, bloque B) — GET/PUT tratan
// el texto como un singleton por tenant (ver inscripcionTexto.js);
// /extraer sube un PDF/DOCX, extrae su texto y lo guarda directamente
// (no se guarda el archivo original, solo el texto resultante).
export default async function academiaDocumentosInscripcionTextoRoutes(app) {
  const guard = makeTenantMembershipGuard();

  app.get("/inscripcion-texto", { preHandler: guard.preHandler }, async (req, reply) => {
    const requestId = req.requestId || makeRequestId();
    const tenantSlug = getTenantSlug(req);
    const auth = await requireRole(req, reply, requestId, { tenantSlug, roles: ["admin"] });
    if (!auth.ok) return;

    const admin = createSupabaseAdmin();
    const { contenido, error } = await fetchTextoInscripcion(admin, auth.tenant.id);
    if (error) {
      req.log.error({ err: error, requestId }, "academia documentos inscripcion-texto fetch failed");
      return fail(reply, 500, "inscripcion_texto_fetch_failed", "Failed to fetch texto", requestId);
    }
    return ok(reply, { contenido }, requestId);
  });

  app.put("/inscripcion-texto", { preHandler: guard.preHandler }, async (req, reply) => {
    const requestId = req.requestId || makeRequestId();
    const tenantSlug = getTenantSlug(req);
    const auth = await requireRole(req, reply, requestId, { tenantSlug, roles: ["admin"] });
    if (!auth.ok) return;

    const parsed = GuardarBodySchema.safeParse(req.body || {});
    if (!parsed.success) return fail(reply, 400, "invalid_body", "Invalid body", requestId, { issues: parsed.error.issues });

    const admin = createSupabaseAdmin();
    const resultado = await guardarTextoInscripcion(admin, auth.tenant.id, parsed.data.contenido);
    if (!resultado.ok) {
      req.log.error({ err: resultado.error, requestId }, "academia documentos inscripcion-texto save failed");
      return fail(reply, 500, "inscripcion_texto_save_failed", "Failed to save texto", requestId);
    }
    return ok(reply, { contenido: parsed.data.contenido }, requestId);
  });

  app.post(
    "/inscripcion-texto/extraer",
    { bodyLimit: 14 * 1024 * 1024, preHandler: guard.preHandler },
    async (req, reply) => {
      const requestId = req.requestId || makeRequestId();
      const tenantSlug = getTenantSlug(req);
      const auth = await requireRole(req, reply, requestId, { tenantSlug, roles: ["admin"] });
      if (!auth.ok) return;

      const rl = await rateLimit(req, { limit: 10, windowSec: 60, userId: auth.user.id, tenantId: auth.tenant.id });
      reply.header("x-ratelimit-limit", rl.limit);
      reply.header("x-ratelimit-remaining", rl.remaining);
      if (!rl.ok) return fail(reply, 429, "rate_limited", "Too many requests", requestId);

      const parsed = ExtraerBodySchema.safeParse(req.body || {});
      if (!parsed.success) return fail(reply, 400, "invalid_body", "Invalid body", requestId, { issues: parsed.error.issues });

      const extraido = await extraerTextoDocumento({ base64Input: parsed.data.base64, mime: parsed.data.mime });
      if (!extraido.ok) {
        return fail(reply, STATUS_POR_CODIGO[extraido.code] || 500, extraido.code, extraido.motivo, requestId);
      }

      const admin = createSupabaseAdmin();
      const guardado = await guardarTextoInscripcion(admin, auth.tenant.id, extraido.texto);
      if (!guardado.ok) {
        req.log.error({ err: guardado.error, requestId }, "academia documentos inscripcion-texto save-after-extract failed");
        return fail(reply, 500, "inscripcion_texto_save_failed", "Failed to save texto", requestId);
      }
      return ok(reply, { contenido: extraido.texto }, requestId);
    }
  );
}
