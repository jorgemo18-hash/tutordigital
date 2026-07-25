import { z } from "zod";
import { makeRequestId } from "../../lib/requestId.js";
import { ok, fail } from "../../lib/http.js";
import { requireRole } from "../../lib/middleware.js";
import { getTenantSlug } from "../../lib/tenantSlug.js";
import { createSupabaseAdmin } from "../../lib/supabase.js";
import { makeTenantMembershipGuard } from "../../lib/security/tenantMembershipGuard.js";
import { enviarAusenciaEmail } from "../../lib/academiaDiario/enviarAusenciaEmail.js";
import { verificarAlumnoVisible } from "../../lib/academiaProfesores/verificarAlumnoVisible.js";

const AusenciaEmailBodySchema = z.object({
  alumno_id: z.string().uuid(),
  fecha: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  hora: z.string().trim().max(20).optional().nullable(),
  motivo: z.string().trim().max(500).optional().nullable(),
});

// Duplicado a propósito desde academia.sesiones.routes.js (mismo criterio
// ya documentado en academia.notas-examen.routes.js/academia.horario.routes.js).
async function findProfesorId(admin, tenantSlug, userId) {
  const { data } = await admin
    .from("teacher_profiles")
    .select("id")
    .eq("tenant_slug", tenantSlug)
    .eq("user_id", userId)
    .maybeSingle();
  return data?.id || null;
}

// POST /api/v1/academia/diario/ausencia-email — notifica por email a la
// familia de una ausencia ya guardada (ver POST /academia/sesiones, que se
// llama antes desde el frontend). No guarda la ausencia — solo envía el
// aviso y marca email_familia_enviado en esa misma fila de academia_sesiones.
export default async function academiaDiarioRoutes(app) {
  const guard = makeTenantMembershipGuard();

  app.post("/ausencia-email", { preHandler: guard.preHandler }, async (req, reply) => {
    const requestId = req.requestId || makeRequestId();
    const tenantSlug = getTenantSlug(req);
    const auth = await requireRole(req, reply, requestId, { tenantSlug, roles: ["admin", "teacher"] });
    if (!auth.ok) return;

    const parsed = AusenciaEmailBodySchema.safeParse(req.body || {});
    if (!parsed.success) return fail(reply, 400, "invalid_body", "Invalid body", requestId, { issues: parsed.error.issues });

    const admin = createSupabaseAdmin();

    const visible = await verificarAlumnoVisible(admin, {
      tenantId: auth.tenant.id, tenantSlug: auth.tenant.slug, userId: auth.user.id,
      role: auth.membership.role, findProfesorIdFn: findProfesorId, alumnoId: parsed.data.alumno_id,
    });
    if (!visible.ok) {
      if (visible.error) {
        req.log.error({ err: visible.error, requestId }, "academia diario: verificar alumno visible failed");
        return fail(reply, 500, "ausencia_email_failed", "No se pudo enviar el aviso.", requestId);
      }
      return fail(reply, 403, "alumno_no_visible", "No tienes acceso a este alumno.", requestId);
    }

    const resultado = await enviarAusenciaEmail(admin, {
      tenantId: auth.tenant.id,
      tenantNombre: auth.tenant.name,
      alumnoId: parsed.data.alumno_id,
      fecha: parsed.data.fecha,
      hora: parsed.data.hora,
      motivo: parsed.data.motivo,
    });

    if (!resultado.ok) {
      if (resultado.code === "not_found") return fail(reply, 404, "not_found", resultado.motivo, requestId);
      if (resultado.code === "no_email") return fail(reply, 422, "no_email", resultado.motivo, requestId);
      req.log.error({ err: resultado, requestId }, "academia diario ausencia-email failed");
      return fail(reply, 500, resultado.code || "ausencia_email_failed", resultado.motivo, requestId);
    }
    return ok(reply, { enviado: true }, requestId);
  });
}
