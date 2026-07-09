import { z } from "zod";
import { makeRequestId } from "../../../lib/requestId.js";
import { ok, fail } from "../../../lib/http.js";
import { rateLimit } from "../../../lib/rateLimit.js";
import { requireRole } from "../../../lib/middleware.js";
import { getTenantSlug } from "../../../lib/tenantSlug.js";
import { createSupabaseAdmin } from "../../../lib/supabase.js";
import { getEnv } from "../../../lib/env.js";
import { chooseExercise } from "../../../lib/orchestrator/exerciseSelection.js";

const BranchSchema = z.object({
  sessionId:     z.string().uuid(),
  exerciseIndex: z.number().int().min(1).max(20),
  exerciseTitle: z.string().max(100).optional().default(""),
});

// ── POST /api/v1/session/branch ───────────────────────────────────────────
// Cambia a un nuevo ejercicio sin reprocesar el documento (Phase 1 ya hecha).
// Crea nueva tutor_session, copia exercises del mapa original, ejecuta Phase 2.
export function registerSessionBranch(app, { guard }) {
  app.post("/branch", { preHandler: guard.preHandler }, async (req, reply) => {
    const requestId  = req.requestId || makeRequestId();
    const tenantSlug = getTenantSlug(req);

    const auth = await requireRole(req, reply, requestId, { tenantSlug, roles: ["student"] });
    if (!auth.ok) return;

    const parsed = BranchSchema.safeParse(req.body || {});
    if (!parsed.success) {
      return fail(reply, 400, "invalid_body", "Invalid body", requestId, { issues: parsed.error.issues });
    }

    const rl = await rateLimit(req, { limit: 20, windowSec: 60, userId: auth.user.id, tenantId: auth.tenant.id });
    if (!rl.ok) return fail(reply, 429, "rate_limited", "Too many requests", requestId);

    const { sessionId, exerciseIndex, exerciseTitle } = parsed.data;
    const admin = createSupabaseAdmin();

    const { data: student } = await admin
      .from("students")
      .select("id")
      .eq("tenant_id", auth.tenant.id)
      .eq("user_id", auth.user.id)
      .maybeSingle();

    if (!student) return fail(reply, 403, "not_student", "No student record found", requestId);

    // Verificar que la sesión original pertenece al alumno
    const { data: originalSession } = await admin
      .from("tutor_sessions")
      .select("task_id, session_date")
      .eq("id", sessionId)
      .eq("tenant_id", auth.tenant.id)
      .eq("student_id", student.id)
      .maybeSingle();

    if (!originalSession) return fail(reply, 404, "not_found", "Session not found", requestId);

    // Copiar exercises y document_text del mapa original (evita reprocesar el PDF)
    const { data: originalMap } = await admin
      .from("tutor_session_maps")
      .select("exercises, document_text")
      .eq("session_id", sessionId)
      .maybeSingle();

    // Crear nueva tutor_session para el nuevo ejercicio
    const { data: newSession, error: sessionErr } = await admin
      .from("tutor_sessions")
      .insert({
        student_id:       student.id,
        task_id:          originalSession.task_id,
        tenant_id:        auth.tenant.id,
        duration_seconds: 0,
        needs_help:       false,
        session_date:     originalSession.session_date,
        exercise_index:   exerciseIndex,
      })
      .select("id")
      .single();

    if (sessionErr || !newSession?.id) {
      return fail(reply, 500, "session_create_failed", "Failed to create new session", requestId);
    }

    // Insertar mapa stub para la nueva sesión (chooseExercise hace UPDATE, necesita la fila)
    await admin.from("tutor_session_maps").insert({
      session_id:    newSession.id,
      steps:         [],
      current_step:  0,
      exercises:     originalMap?.exercises || [{ index: exerciseIndex, title: exerciseTitle }],
      document_text: originalMap?.document_text || "",
    });

    // Phase 2: generar mapa de pasos para el ejercicio elegido (reutiliza cache Anthropic)
    const apiKey = getEnv("ANTHROPIC_API_KEY", "");
    if (!apiKey) return fail(reply, 500, "missing_config", "Missing AI configuration", requestId);

    try {
      const mapResult = await chooseExercise({
        sessionId:     newSession.id,
        exerciseIndex,
        exerciseTitle,
        apiKey,
      });
      return ok(reply, { sessionId: newSession.id, steps: mapResult.steps, currentStep: 0 }, requestId);
    } catch (err) {
      console.error("[session.branch] chooseExercise failed:", err?.message);
      return fail(reply, 500, "step_map_failed", "Failed to generate step map", requestId);
    }
  });
}
