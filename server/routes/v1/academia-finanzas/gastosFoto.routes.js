import { z } from "zod";
import { makeRequestId } from "../../../lib/requestId.js";
import { ok, fail } from "../../../lib/http.js";
import { requireRole } from "../../../lib/middleware.js";
import { getTenantSlug } from "../../../lib/tenantSlug.js";
import { createSupabaseAdmin } from "../../../lib/supabase.js";
import { makeTenantMembershipGuard } from "../../../lib/security/tenantMembershipGuard.js";
import { subirFotoGasto, ALLOWED_FOTO_MIMES } from "../../../lib/academiaFinanzas/gastoFoto.js";

const ParamsSchema = z.object({ id: z.string().uuid() });
const UploadBodySchema = z.object({
  base64: z.string().min(1),
  mime: z.enum([...ALLOWED_FOTO_MIMES]),
});

// POST /api/v1/academia/finanzas/gastos/:id/upload-foto — sube la foto/PDF
// de una factura. `id` puede ser un gasto real (modo edición, donde
// subirFotoGasto actualiza foto_url ahí mismo) o un UUID temporal generado
// por el frontend antes de crear el gasto (flujo de OCR, ver
// gastoUpload.js) — en ese caso no hay fila que actualizar todavía, solo se
// devuelve la URL para incluirla luego en el POST de creación.
export default async function academiaFinanzasGastosFotoRoutes(app) {
  const guard = makeTenantMembershipGuard();

  app.post("/:id/upload-foto", { preHandler: guard.preHandler }, async (req, reply) => {
    const requestId = req.requestId || makeRequestId();
    const tenantSlug = getTenantSlug(req);
    const auth = await requireRole(req, reply, requestId, { tenantSlug, roles: ["admin"] });
    if (!auth.ok) return;

    const parsedParams = ParamsSchema.safeParse(req.params || {});
    if (!parsedParams.success) return fail(reply, 400, "invalid_params", "Invalid params", requestId);
    const parsed = UploadBodySchema.safeParse(req.body || {});
    if (!parsed.success) return fail(reply, 400, "invalid_body", "Invalid body", requestId, { issues: parsed.error.issues });

    const admin = createSupabaseAdmin();
    const resultado = await subirFotoGasto(admin, {
      tenantId: auth.tenant.id,
      id: parsedParams.data.id,
      base64Input: parsed.data.base64,
      mime: parsed.data.mime,
    });
    if (!resultado.ok) {
      const status = resultado.code === "payload_too_large" ? 413 : resultado.code === "unsupported_mime" ? 415 : 500;
      return fail(reply, status, resultado.code, resultado.motivo, requestId);
    }
    return ok(reply, { url: resultado.url }, requestId);
  });
}
