import { makeRequestId } from "../../../lib/requestId.js";
import { ok, fail } from "../../../lib/http.js";
import { requireRole } from "../../../lib/middleware.js";
import { getTenantSlug } from "../../../lib/tenantSlug.js";
import { createSupabaseAdmin } from "../../../lib/supabase.js";
import { getSessionMap } from "../../../lib/orchestrator/sessionMap.js";
import { verificarAlumnoVisible } from "../../../lib/instituto/alumnosVisibles.js";

// ── GET /api/v1/session/:sessionId/map ────────────────────────────────────
export function registerSessionMap(app, { guard }) {
  app.get("/:sessionId/map", { preHandler: guard.preHandler }, async (req, reply) => {
    const requestId  = req.requestId || makeRequestId();
    const tenantSlug = getTenantSlug(req);

    const auth = await requireRole(req, reply, requestId, { tenantSlug, roles: ["student", "teacher", "admin"] });
    if (!auth.ok) return;

    const { sessionId } = req.params;
    if (!sessionId) return fail(reply, 400, "missing_param", "Missing sessionId", requestId);

    // El mapa lleva el enunciado troceado de los ejercicios de ese alumno.
    // Solo se comprueba para PROFESOR: el alumno entra por otro camino (su
    // propia sesión) y el admin ve todo el centro. Se hace antes de leer el
    // mapa para no cargarlo y luego tirarlo (09/09/2026).
    if (auth.membership.role === "teacher") {
      const admin = createSupabaseAdmin();
      const { data: sessionRow } = await admin
        .from("tutor_sessions")
        .select("student_id")
        .eq("id", sessionId)
        .eq("tenant_id", auth.tenant.id)
        .maybeSingle();
      if (!sessionRow) return fail(reply, 404, "not_found", "Map not found", requestId);

      const alumnoOk = await verificarAlumnoVisible(admin, {
        role: "teacher",
        tenantId: auth.tenant.id,
        tenantSlug: auth.tenant.slug,
        userId: auth.user.id,
        email: auth.user.email || "",
        alumnoId: sessionRow.student_id,
      });
      if (!alumnoOk.ok) {
        if (alumnoOk.code === "visibilidad_fetch_failed") {
          req.log.error({ err: alumnoOk.error, requestId }, "session map: fallo resolviendo visibilidad");
          return fail(reply, 500, "visibilidad_fetch_failed", "No se pudo comprobar el acceso", requestId);
        }
        return fail(reply, 404, "not_found", "Map not found", requestId);
      }
    }

    const result = await getSessionMap(sessionId, auth.tenant.id);
    if (!result.ok) {
      const status = result.error === "forbidden" ? 403 : result.error === "not_found" ? 404 : 500;
      return fail(reply, status, result.error, "Map not found", requestId);
    }

    return ok(reply, { steps: result.steps, currentStep: result.currentStep, exercises: result.exercises || [] }, requestId);
  });
}
