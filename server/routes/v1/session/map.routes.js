import { makeRequestId } from "../../../lib/requestId.js";
import { ok, fail } from "../../../lib/http.js";
import { requireRole } from "../../../lib/middleware.js";
import { getTenantSlug } from "../../../lib/tenantSlug.js";
import { getSessionMap } from "../../../lib/orchestrator.js";

// ── GET /api/v1/session/:sessionId/map ────────────────────────────────────
export function registerSessionMap(app, { guard }) {
  app.get("/:sessionId/map", { preHandler: guard.preHandler }, async (req, reply) => {
    const requestId  = req.requestId || makeRequestId();
    const tenantSlug = getTenantSlug(req);

    const auth = await requireRole(req, reply, requestId, { tenantSlug, roles: ["student", "teacher", "admin"] });
    if (!auth.ok) return;

    const { sessionId } = req.params;
    if (!sessionId) return fail(reply, 400, "missing_param", "Missing sessionId", requestId);

    const result = await getSessionMap(sessionId, auth.tenant.id);
    if (!result.ok) {
      const status = result.error === "forbidden" ? 403 : result.error === "not_found" ? 404 : 500;
      return fail(reply, status, result.error, "Map not found", requestId);
    }

    return ok(reply, { steps: result.steps, currentStep: result.currentStep, exercises: result.exercises || [] }, requestId);
  });
}
