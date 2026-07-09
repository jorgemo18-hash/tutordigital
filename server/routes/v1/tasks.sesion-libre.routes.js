import { makeRequestId } from "../../lib/requestId.js";
import { ok, fail } from "../../lib/http.js";
import { rateLimit } from "../../lib/rateLimit.js";
import { requireRole } from "../../lib/middleware.js";
import { getTenantSlug } from "../../lib/tenantSlug.js";
import { createSupabaseAdmin } from "../../lib/supabase.js";
import { makeTenantMembershipGuard } from "../../lib/security/tenantMembershipGuard.js";
import { getStudentForUser } from "../../lib/tasksHelpers.js";
import { ensureSesionLibreTask } from "../../lib/sesionLibreTask.js";

// Sesión libre: sesión de tutor iniciada por el alumno sin tarea asignada
// por un profesor (caso academia). Obtiene o crea la tarea de sistema del
// día — ver server/lib/sesionLibreTask.js. Montado bajo el mismo prefix
// que tasks.routes.js (/api/v1/tasks) en app.js.
export default async function tasksSesionLibreRoutes(app) {
  const guard = makeTenantMembershipGuard();

  app.post("/sesion-libre", { preHandler: guard.preHandler }, async (req, reply) => {
    const requestId = req.requestId || makeRequestId();
    const tenantSlug = getTenantSlug(req);

    const auth = await requireRole(req, reply, requestId, { tenantSlug, roles: ["student"] });
    if (!auth.ok) return;

    const rl = await rateLimit(req, { limit: 10, windowSec: 60, userId: auth.user.id, tenantId: auth.tenant.id });
    if (!rl.ok) return fail(reply, 429, "rate_limited", "Too many requests", requestId);

    const admin = createSupabaseAdmin();
    const student = await getStudentForUser(admin, auth.tenant.id, auth.user.id);
    if (!student) return fail(reply, 403, "not_student", "No student record found", requestId);

    try {
      const task = await ensureSesionLibreTask(admin, { tenantId: auth.tenant.id, studentId: student.id });
      return ok(reply, { task }, requestId);
    } catch (err) {
      console.error("[tasks.sesion-libre] Error:", err?.message);
      return fail(reply, 500, "sesion_libre_failed", "No se pudo crear la sesión libre", requestId);
    }
  });
}
