import { z } from "zod";
import { makeRequestId } from "../../lib/requestId.js";
import { ok, fail } from "../../lib/http.js";
import { rateLimit } from "../../lib/rateLimit.js";
import { requireRole } from "../../lib/middleware.js";
import { getTenantSlug } from "../../lib/tenantSlug.js";
import { createSupabaseAdmin } from "../../lib/supabase.js";
import { makeTenantMembershipGuard } from "../../lib/security/tenantMembershipGuard.js";
import { getEnv } from "../../lib/env.js";
import { startSession, chooseExercise, getSessionMap } from "../../lib/orchestrator.js";

const StartSchema = z.object({
  taskId: z.string().uuid(),
  mode:   z.string().max(40).optional(),
});

const ChooseSchema = z.object({
  sessionId:     z.string().uuid(),
  exerciseIndex: z.number().int().min(1).max(20),
  exerciseTitle: z.string().max(100).optional(),
});

export default async function sessionRoutes(app) {
  const guard = makeTenantMembershipGuard();

  // ── POST /api/v1/session/start ─────────────────────────────────────────────
  // Phase 1: detecta ejercicios. Devuelve 'needs_choice' (varios ejercicios)
  // o 'ready' (uno solo, pasos generados directamente).
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

    const admin          = createSupabaseAdmin();
    const { taskId, mode } = parsed.data;

    const { data: student } = await admin
      .from("students")
      .select("id")
      .eq("tenant_id", auth.tenant.id)
      .eq("user_id", auth.user.id)
      .maybeSingle();

    if (!student) return fail(reply, 403, "not_student", "No student record found", requestId);

    // Tarea + adjuntos en un solo bloque
    const [{ data: task }, { data: attachmentRows }] = await Promise.all([
      admin.from("tasks").select("title, description")
        .eq("id", taskId).eq("tenant_id", auth.tenant.id).maybeSingle(),
      admin.from("attachments").select("id, file_name, mime, storage_path, role")
        .eq("owner_type", "task").eq("owner_id", taskId),
    ]);

    if (!task) return fail(reply, 404, "task_not_found", "Task not found", requestId);

    // [DIAG] Log de adjuntos que llegan de la BD antes de pasarlos al Guía
    console.log(`[DIAG session.start] taskId=${taskId} attachmentRows:`, JSON.stringify(attachmentRows));

    const apiKey = getEnv("ANTHROPIC_API_KEY", "");
    if (!apiKey) return fail(reply, 500, "missing_config", "Missing AI configuration", requestId);

    try {
      const result = await startSession({
        studentId:   student.id,
        taskId,
        tenantId:    auth.tenant.id,
        taskContext: {
          title:       task.title       || "",
          description: task.description || "",
          attachments: attachmentRows   || [],
        },
        mode: mode || "deberes",
        apiKey,
      });
      return ok(reply, result, requestId);
    } catch (err) {
      console.error("[session.start] Error:", err?.message);
      return fail(reply, 500, "session_failed", "Failed to start session", requestId);
    }
  });

  // ── POST /api/v1/session/choose ────────────────────────────────────────────
  // Phase 2: el alumno eligió un ejercicio; el Guía genera el mapa de pasos.
  // El documento ya está cacheado en Anthropic desde Phase 1.
  app.post("/choose", { preHandler: guard.preHandler }, async (req, reply) => {
    const requestId  = req.requestId || makeRequestId();
    const tenantSlug = getTenantSlug(req);

    const auth = await requireRole(req, reply, requestId, { tenantSlug, roles: ["student"] });
    if (!auth.ok) return;

    const parsed = ChooseSchema.safeParse(req.body);
    if (!parsed.success) {
      return fail(reply, 400, "invalid_body", "Invalid body", requestId, { issues: parsed.error.issues });
    }

    const rl = await rateLimit(req, { limit: 20, windowSec: 60, userId: auth.user.id, tenantId: auth.tenant.id });
    if (!rl.ok) return fail(reply, 429, "rate_limited", "Too many requests", requestId);

    const { sessionId, exerciseIndex, exerciseTitle } = parsed.data;

    // Verificar que la sesión pertenece al alumno autenticado
    const admin = createSupabaseAdmin();
    const { data: student } = await admin
      .from("students")
      .select("id")
      .eq("tenant_id", auth.tenant.id)
      .eq("user_id", auth.user.id)
      .maybeSingle();

    if (!student) return fail(reply, 403, "not_student", "No student record found", requestId);

    const { data: sessionRow } = await admin
      .from("tutor_sessions")
      .select("id")
      .eq("id", sessionId)
      .eq("student_id", student.id)
      .maybeSingle();

    if (!sessionRow) return fail(reply, 403, "session_forbidden", "Session not found or forbidden", requestId);

    const apiKey = getEnv("ANTHROPIC_API_KEY", "");
    if (!apiKey) return fail(reply, 500, "missing_config", "Missing AI configuration", requestId);

    try {
      const result = await chooseExercise({ sessionId, exerciseIndex, exerciseTitle: exerciseTitle || "", apiKey });
      return ok(reply, result, requestId);
    } catch (err) {
      console.error("[session.choose] Error:", err?.message);
      return fail(reply, 500, "choose_failed", "Failed to generate step map", requestId);
    }
  });

  // ── GET /api/v1/session/:sessionId/map ────────────────────────────────────
  app.get("/:sessionId/map", { preHandler: guard.preHandler }, async (req, reply) => {
    const requestId  = req.requestId || makeRequestId();
    const tenantSlug = getTenantSlug(req);

    const auth = await requireRole(req, reply, requestId, { tenantSlug, roles: ["student", "teacher", "admin"] });
    if (!auth.ok) return;

    const { sessionId } = req.params;
    if (!sessionId) return fail(reply, 400, "missing_param", "Missing sessionId", requestId);

    const result = await getSessionMap(sessionId);
    if (!result.ok) {
      return fail(reply, result.error === "not_found" ? 404 : 500, result.error, "Map not found", requestId);
    }

    return ok(reply, { steps: result.steps, currentStep: result.currentStep }, requestId);
  });
}
