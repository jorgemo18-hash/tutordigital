import { z } from "zod";
import { makeRequestId } from "../../../lib/requestId.js";
import { ok, fail } from "../../../lib/http.js";
import { rateLimit } from "../../../lib/rateLimit.js";
import { requireRole } from "../../../lib/middleware.js";
import { getTenantSlug } from "../../../lib/tenantSlug.js";
import { createSupabaseAdmin } from "../../../lib/supabase.js";
import { getEnv } from "../../../lib/env.js";
import { chooseExercise } from "../../../lib/orchestrator.js";

const ChooseSchema = z.object({
  sessionId:     z.string().uuid(),
  exerciseIndex: z.number().int().min(1).max(20),
  exerciseTitle: z.string().max(100).optional(),
});

// ── POST /api/v1/session/choose ────────────────────────────────────────────
// Phase 2: el alumno eligió un ejercicio; el Guía genera el mapa de pasos.
// El documento ya está cacheado en Anthropic desde Phase 1.
export function registerSessionChoose(app, { guard }) {
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
}
