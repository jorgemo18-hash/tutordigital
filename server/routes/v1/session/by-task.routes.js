import { makeRequestId } from "../../../lib/requestId.js";
import { ok, fail } from "../../../lib/http.js";
import { rateLimit } from "../../../lib/rateLimit.js";
import { requireRole } from "../../../lib/middleware.js";
import { getTenantSlug } from "../../../lib/tenantSlug.js";
import { createSupabaseAdmin } from "../../../lib/supabase.js";

// ── GET /api/v1/session/by-task/:taskId?student_id=X ─────────────────────
// Profesor/admin: historial de sesiones de un alumno para una tarea.
// Excluye sesiones in_progress sin mensajes reales (huérfanas históricas).
export function registerSessionByTask(app, { guard }) {
  app.get("/by-task/:taskId", { preHandler: guard.preHandler }, async (req, reply) => {
    const requestId  = req.requestId || makeRequestId();
    const tenantSlug = getTenantSlug(req);

    const auth = await requireRole(req, reply, requestId, { tenantSlug, roles: ["teacher", "admin"] });
    if (!auth.ok) return;

    const { taskId } = req.params;
    const studentId  = req.query.student_id;
    if (!taskId)    return fail(reply, 400, "missing_param", "Missing taskId", requestId);
    if (!studentId) return fail(reply, 400, "missing_param", "Missing student_id", requestId);

    const rl = await rateLimit(req, { limit: 60, windowSec: 60, userId: auth.user.id, tenantId: auth.tenant.id });
    if (!rl.ok) return fail(reply, 429, "rate_limited", "Too many requests", requestId);

    const admin = createSupabaseAdmin();

    // Todas las sesiones sin filtro de outcome; incluye current_step y steps para badge
    const { data: rawSessions } = await admin
      .from("tutor_sessions")
      .select("id, session_date, duration_seconds, needs_help, outcome, exercise_index, teacher_reviewed, tutor_session_maps(exercises, current_step, steps)")
      .eq("tenant_id", auth.tenant.id)
      .eq("task_id",   taskId)
      .eq("student_id", studentId)
      .order("created_at", { ascending: true })
      .limit(50);

    // Contar mensajes por sesión para detectar sesiones huérfanas (in_progress sin actividad)
    const allIds = (rawSessions || []).map(s => s.id);
    const { data: msgRows } = allIds.length
      ? await admin.from("session_messages").select("session_id").in("session_id", allIds)
      : { data: [] };

    const msgCount = {};
    (msgRows || []).forEach(m => { msgCount[m.session_id] = (msgCount[m.session_id] || 0) + 1; });

    // Total de ejercicios del Guide (máximo de los mapas disponibles)
    let totalExercises = 0;
    (rawSessions || []).forEach(s => {
      const mapRow = Array.isArray(s.tutor_session_maps) ? s.tutor_session_maps[0] : s.tutor_session_maps;
      const n = Array.isArray(mapRow?.exercises) ? mapRow.exercises.length : 0;
      if (n > totalExercises) totalExercises = n;
    });

    // Filtrar: sesión válida si outcome != 'in_progress' O tiene mensajes reales
    const realSessions = (rawSessions || []).filter(s =>
      s.outcome !== "in_progress" || (msgCount[s.id] || 0) > 0
    );

    const sessions = realSessions.map(s => {
      const mapRow  = Array.isArray(s.tutor_session_maps) ? s.tutor_session_maps[0] : s.tutor_session_maps;
      const exList  = Array.isArray(mapRow?.exercises) ? mapRow.exercises : [];
      const steps   = Array.isArray(mapRow?.steps)     ? mapRow.steps     : [];
      const exEntry = exList.find(e => e.index === s.exercise_index) || null;
      return {
        id:               s.id,
        session_date:     s.session_date,
        duration_seconds: s.duration_seconds,
        needs_help:       s.needs_help,
        outcome:          s.outcome,
        exercise_index:   s.exercise_index,
        exercise_title:   exEntry?.title || null,
        step_count:       steps.length,
        current_step:     mapRow?.current_step ?? 0,
        message_count:    msgCount[s.id] || 0,
        teacher_reviewed: s.teacher_reviewed || false,
      };
    });

    return ok(reply, { sessions, totalExercises }, requestId);
  });
}
