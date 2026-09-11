import { z } from "zod";
import { makeRequestId } from "../../../lib/requestId.js";
import { ok, fail } from "../../../lib/http.js";
import { requireRole } from "../../../lib/middleware.js";
import { getTenantSlug } from "../../../lib/tenantSlug.js";
import { createSupabaseAdmin } from "../../../lib/supabase.js";
import { makeTenantMembershipGuard } from "../../../lib/security/tenantMembershipGuard.js";
import { subirFotoGasto, ALLOWED_FOTO_MIMES } from "../../../lib/academiaFinanzas/gastoFoto.js";
import { descargarArchivoPrivado, mimeDeRuta } from "../../../lib/academiaStorage/archivoPrivado.js";

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
      // Mismo motivo que en upload-ficha: este 500 era ciego (migración 117).
      req.log.error(
        { err: resultado.error, code: resultado.code, requestId },
        "upload-foto gasto: no se pudo guardar la factura"
      );
      return fail(reply, status, resultado.code, resultado.motivo, requestId);
    }
    return ok(reply, { path: resultado.path }, requestId);
  });

  // GET /api/v1/academia/finanzas/gastos/:id/foto/archivo — la factura en sí,
  // descargada del bucket privado y reenviada aquí. Nunca una URL de Storage:
  // una factura lleva el nombre del proveedor, el del centro y sus importes.
  // Mismo patrón y mismo motivo que la ficha del alumno (migración 114).
  app.get("/:id/foto/archivo", { preHandler: guard.preHandler }, async (req, reply) => {
    const requestId = req.requestId || makeRequestId();
    const tenantSlug = getTenantSlug(req);
    const auth = await requireRole(req, reply, requestId, { tenantSlug, roles: ["admin"] });
    if (!auth.ok) return;

    const parsedParams = ParamsSchema.safeParse(req.params || {});
    if (!parsedParams.success) return fail(reply, 400, "invalid_params", "Invalid params", requestId);

    const admin = createSupabaseAdmin();
    const { data: gasto } = await admin
      .from("academia_gastos")
      .select("foto_path")
      .eq("id", parsedParams.data.id)
      .eq("tenant_id", auth.tenant.id)
      .maybeSingle();

    // 404 también con la factura antigua todavía en foto_url — el frontend
    // cae a la URL vieja hasta que se ejecute el script de migración.
    if (!gasto?.foto_path) {
      return fail(reply, 404, "not_found", "Este gasto no tiene factura guardada.", requestId);
    }

    const archivo = await descargarArchivoPrivado(admin, gasto.foto_path);
    if (!archivo.ok) return fail(reply, 500, archivo.code, archivo.motivo, requestId);

    reply.header("Content-Type", mimeDeRuta(gasto.foto_path));
    reply.header("Cache-Control", "private, no-store");
    return reply.send(archivo.buffer);
  });
}
