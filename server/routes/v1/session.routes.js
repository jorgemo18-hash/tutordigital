import { z } from "zod";
import { makeRequestId } from "../../lib/requestId.js";
import { ok, fail } from "../../lib/http.js";
import { rateLimit } from "../../lib/rateLimit.js";
import { requireRole } from "../../lib/middleware.js";
import { getTenantSlug } from "../../lib/tenantSlug.js";
import { createSupabaseAdmin } from "../../lib/supabase.js";
import { makeTenantMembershipGuard } from "../../lib/security/tenantMembershipGuard.js";
import { getEnv } from "../../lib/env.js";
import { startSession, getSessionMap } from "../../lib/orchestrator.js";

const StartSchema = z.object({
  taskId: z.string().uuid(),
  mode:   z.string().max(40).optional(),
});

export default async function sessionRoutes(app) {
  const guard = makeTenantMembershipGuard();

  // POST /api/v1/session/start — alumno abre una tarea; el Guía genera el mapa.
  // Bloquea hasta que el mapa esté listo (~5-15 s con Opus).
  app.post("/start", { preHandler: guard.preHandler }, async (req, reply) => {
    const requestId  = req.requestId || makeRequestId();
    const tenantSlug = getTenantSlug(req);

    const auth = await requireRole(req, reply, requestId, { tenantSlug, roles: ["student"] });
    if (!auth.ok) return;

    const parsed = StartSchema.safeParse(req.body);
    if (!parsed.success) {
      return fail(reply, 400, "invalid_body", "Invalid body", requestId, { issues: parsed.error.issues });
    }

    const rl = await rateLimit(req, { limit: 20, windowSec: 60, userId: auth.user.id, tenantId: auth.tenant.id });
    if (!rl.ok) return fail(reply, 429, "rate_limited", "Too many requests", requestId);

    const admin        = createSupabaseAdmin();
    const { taskId, mode } = parsed.data;

    // Verificar que el alumno existe en este tenant
    const { data: student } = await admin
      .from("students")
      .select("id")
      .eq("tenant_id", auth.tenant.id)
      .eq("user_id", auth.user.id)
      .maybeSingle();

    if (!student) {
      return fail(reply, 403, "not_student", "No student record found", requestId);
    }

    // Obtener contexto de la tarea (verificar pertenencia al tenant)
    const { data: task } = await admin
      .from("tasks")
      .select("title, description")
      .eq("id", taskId)
      .eq("tenant_id", auth.tenant.id)
      .maybeSingle();

    if (!task) {
      return fail(reply, 404, "task_not_found", "Task not found", requestId);
    }

    const apiKey = getEnv("ANTHROPIC_API_KEY", "");
    if (!apiKey) {
      return fail(reply, 500, "missing_config", "Missing AI configuration", requestId);
    }

    try {
      const result = await startSession({
        studentId:   student.id,
        taskId,
        tenantId:    auth.tenant.id,
        taskContext: { title: task.title || "", description: task.description || "" },
        mode:        mode || "deberes",
        apiKey,
      });

      return ok(reply, result, requestId);
    } catch (err) {
      console.error("[session.start] Error:", err?.message);
      return fail(reply, 500, "session_failed", "Failed to start session", requestId);
    }
  });

  // GET /api/v1/session/:sessionId/map — devuelve el mapa actual de pasos.
  app.get("/:sessionId/map", { preHandler: guard.preHandler }, async (req, reply) => {
    const requestId  = req.requestId || makeRequestId();
    const tenantSlug = getTenantSlug(req);

    const auth = await requireRole(req, reply, requestId, {
      tenantSlug,
      roles: ["student", "teacher", "admin"],
    });
    if (!auth.ok) return;

    const { sessionId } = req.params;
    if (!sessionId) return fail(reply, 400, "missing_param", "Missing sessionId", requestId);

    const result = await getSessionMap(sessionId);
    if (!result.ok) {
      const status = result.error === "not_found" ? 404 : 500;
      return fail(reply, status, result.error, "Map not found", requestId);
    }

    return ok(reply, { steps: result.steps, currentStep: result.currentStep }, requestId);
  });
}
