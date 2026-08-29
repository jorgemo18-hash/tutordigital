import { z } from "zod";
import { makeRequestId } from "../../lib/requestId.js";
import { ok, fail } from "../../lib/http.js";
import { requireRole } from "../../lib/middleware.js";
import { getTenantSlug } from "../../lib/tenantSlug.js";
import { createSupabaseAdmin } from "../../lib/supabase.js";
import { makeTenantMembershipGuard } from "../../lib/security/tenantMembershipGuard.js";
import { subirFichaAlumno, ALLOWED_FOTO_MIMES } from "../../lib/academiaAlumnos/fichaFoto.js";

const ParamsSchema = z.object({ id: z.string().uuid() });
const UploadBodySchema = z.object({
  base64: z.string().min(1),
  mime: z.enum([...ALLOWED_FOTO_MIMES]),
});

// POST /api/v1/academia/alumnos/:id/upload-ficha — guarda la foto de la
// ficha de inscripción en papel y deja su URL en academia_alumnos.ficha_url
// (migración 110).
//
// El alumno tiene que EXISTIR: a diferencia del flujo de gastos (que
// aceptaba un id temporal inventado por el cliente y dejaba archivos
// huérfanos en Storage), aquí se sube siempre contra un id real, después de
// crear al alumno. Un id que no sea de este centro no encuentra fila y se
// responde 404 en vez de escribir en la de otro.
export default async function academiaAlumnosFichaRoutes(app) {
  const guard = makeTenantMembershipGuard();

  app.post("/:id/upload-ficha", { preHandler: guard.preHandler }, async (req, reply) => {
    const requestId = req.requestId || makeRequestId();
    const tenantSlug = getTenantSlug(req);
    const auth = await requireRole(req, reply, requestId, { tenantSlug, roles: ["admin"] });
    if (!auth.ok) return;

    const parsedParams = ParamsSchema.safeParse(req.params || {});
    if (!parsedParams.success) return fail(reply, 400, "invalid_params", "Invalid params", requestId);
    const parsed = UploadBodySchema.safeParse(req.body || {});
    if (!parsed.success) return fail(reply, 400, "invalid_body", "Invalid body", requestId, { issues: parsed.error.issues });

    const admin = createSupabaseAdmin();

    // Se comprueba ANTES de subir: sin esto, un id de otro centro dejaría el
    // archivo escrito en el bucket bajo el tenant de quien lo sube aunque el
    // UPDATE posterior no afectara a ninguna fila.
    const { data: alumno, error: lookupErr } = await admin
      .from("academia_alumnos")
      .select("id")
      .eq("id", parsedParams.data.id)
      .eq("tenant_id", auth.tenant.id)
      .maybeSingle();
    if (lookupErr) return fail(reply, 500, "alumno_lookup_failed", "Failed to fetch alumno", requestId);
    if (!alumno) return fail(reply, 404, "alumno_not_found", "Alumno not found", requestId);

    const resultado = await subirFichaAlumno(admin, {
      tenantId: auth.tenant.id,
      id: parsedParams.data.id,
      base64Input: parsed.data.base64,
      mime: parsed.data.mime,
    });
    if (!resultado.ok) {
      const status = resultado.code === "payload_too_large" ? 413
        : resultado.code === "unsupported_mime" ? 415
        : resultado.code === "conversion_failed" ? 422
        : 500;
      return fail(reply, status, resultado.code, resultado.motivo, requestId);
    }
    return ok(reply, { url: resultado.url }, requestId);
  });
}
