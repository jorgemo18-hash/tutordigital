import { z } from "zod";
import { makeRequestId } from "../../../lib/requestId.js";
import { ok, fail } from "../../../lib/http.js";
import { rateLimit } from "../../../lib/rateLimit.js";
import { requireRole } from "../../../lib/middleware.js";
import { getTenantSlug } from "../../../lib/tenantSlug.js";
import { createSupabaseAdmin } from "../../../lib/supabase.js";
import { makeTenantMembershipGuard } from "../../../lib/security/tenantMembershipGuard.js";
import { subirAssetConfig, ALLOWED_ASSET_MIMES } from "../../../lib/academiaConfig/uploadAsset.js";

const UploadBodySchema = z.object({
  base64: z.string().min(1),
  mime: z.enum([...ALLOWED_ASSET_MIMES]),
});

const STATUS_POR_CODIGO = { payload_too_large: 413, unsupported_mime: 415, invalid_base64: 400 };

async function handleUpload(req, reply, { slot }) {
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
  const resultado = await subirAssetConfig(admin, {
    tenantId: auth.tenant.id,
    slot,
    base64Input: parsed.data.base64,
    mime: parsed.data.mime,
  });
  if (!resultado.ok) {
    return fail(reply, STATUS_POR_CODIGO[resultado.code] || 500, resultado.code, resultado.motivo, requestId);
  }
  return ok(reply, { url: resultado.url }, requestId);
}

// POST /api/v1/academia/config/upload-logo y /upload-bg — reciben
// {base64, mime} (igual que /academia/inscripciones/extraer, sin
// multipart) y guardan la URL pública resultante en academia_config.
export default async function academiaConfigUploadRoutes(app) {
  const guard = makeTenantMembershipGuard();

  app.post("/upload-logo", { bodyLimit: 8 * 1024 * 1024, preHandler: guard.preHandler }, (req, reply) =>
    handleUpload(req, reply, { slot: "logo" })
  );
  app.post("/upload-bg", { bodyLimit: 8 * 1024 * 1024, preHandler: guard.preHandler }, (req, reply) =>
    handleUpload(req, reply, { slot: "bg" })
  );
}
