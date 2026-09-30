import { z } from "zod";
import { makeRequestId } from "../../../lib/requestId.js";
import { ok, fail } from "../../../lib/http.js";
import { requireRole } from "../../../lib/middleware.js";
import { getTenantSlug } from "../../../lib/tenantSlug.js";
import { createSupabaseAdmin } from "../../../lib/supabase.js";
import { makeTenantMembershipGuard } from "../../../lib/security/tenantMembershipGuard.js";
import { descargarArchivoPrivado } from "../../../lib/academiaStorage/archivoPrivado.js";
import { fetchDocumentosEnviados, fetchDocumentoEnviado } from "../../../lib/academiaEnvio/documentosEnviados.js";

const ListaQuerySchema = z.object({
  familia_id: z.string().uuid(),
  tipo: z.enum(["recibo", "informe"]),
  mes: z.coerce.number().int().min(1).max(12),
  anio: z.coerce.number().int().min(2000).max(2100),
  alumno_id: z.string().uuid().optional(),
});
const ParamsSchema = z.object({ id: z.string().uuid() });

// Los PDF exactos que recibieron las familias (migración 147): la lista de
// un documento (del más reciente al más antiguo) y el archivo en sí, que se
// sirve con sesión de admin y nunca por URL directa (como las fichas).
export default async function academiaRecibosEnviadosRoutes(app) {
  const guard = makeTenantMembershipGuard();

  // GET /api/v1/academia/recibos/enviados?familia_id=&tipo=&mes=&anio=[&alumno_id=]
  app.get("/enviados", { preHandler: guard.preHandler }, async (req, reply) => {
    const requestId = req.requestId || makeRequestId();
    const auth = await requireRole(req, reply, requestId, { tenantSlug: getTenantSlug(req), roles: ["admin"] });
    if (!auth.ok) return;
    const parsed = ListaQuerySchema.safeParse(req.query || {});
    if (!parsed.success) return fail(reply, 400, "invalid_query", "Invalid query", requestId, { issues: parsed.error.issues });
    const { familia_id: familiaId, tipo, mes, anio, alumno_id: alumnoId } = parsed.data;

    const { documentos, error } = await fetchDocumentosEnviados(createSupabaseAdmin(), auth.tenant.id, { familiaId, tipo, mes, anio, alumnoId });
    if (error) {
      req.log.error({ err: error, requestId }, "academia documentos enviados: list failed");
      return fail(reply, 500, "enviados_fetch_failed", "No se pudieron leer los envíos.", requestId);
    }
    return ok(reply, { documentos }, requestId);
  });

  // GET /api/v1/academia/recibos/enviados/:id/archivo
  app.get("/enviados/:id/archivo", { preHandler: guard.preHandler }, async (req, reply) => {
    const requestId = req.requestId || makeRequestId();
    const auth = await requireRole(req, reply, requestId, { tenantSlug: getTenantSlug(req), roles: ["admin"] });
    if (!auth.ok) return;
    const parsedParams = ParamsSchema.safeParse(req.params || {});
    if (!parsedParams.success) return fail(reply, 400, "invalid_params", "Invalid params", requestId);

    const admin = createSupabaseAdmin();
    const { documento, error } = await fetchDocumentoEnviado(admin, auth.tenant.id, parsedParams.data.id);
    if (error) return fail(reply, 500, "enviados_fetch_failed", "No se pudo leer el envío.", requestId);
    // 404 también si es de otro centro: un 403 confirmaría que el id existe.
    if (!documento) return fail(reply, 404, "not_found", "Ese documento no existe.", requestId);

    const archivo = await descargarArchivoPrivado(admin, documento.storage_path);
    if (!archivo.ok) return fail(reply, 500, archivo.code, archivo.motivo, requestId);
    reply.header("Content-Type", "application/pdf");
    reply.header("Content-Disposition", `inline; filename="${documento.nombre_archivo.replace(/"/g, "")}"`);
    reply.header("Cache-Control", "private, no-store");
    return reply.send(archivo.buffer);
  });
}
