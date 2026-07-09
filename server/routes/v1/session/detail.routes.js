import { makeRequestId } from "../../../lib/requestId.js";
import { ok, fail } from "../../../lib/http.js";
import { requireRole } from "../../../lib/middleware.js";
import { getTenantSlug } from "../../../lib/tenantSlug.js";
import { createSupabaseAdmin } from "../../../lib/supabase.js";

// ── GET /api/v1/session/:sessionId/detail ────────────────────────────────
// Profesor obtiene el detalle completo: pasos + mensajes + nota del alumno.
export function registerSessionDetail(app, { guard }) {
  app.get("/:sessionId/detail", { preHandler: guard.preHandler }, async (req, reply) => {
    const requestId  = req.requestId || makeRequestId();
    const tenantSlug = getTenantSlug(req);

    const auth = await requireRole(req, reply, requestId, { tenantSlug, roles: ["teacher", "admin"] });
    if (!auth.ok) return;

    const { sessionId } = req.params;
    if (!sessionId) return fail(reply, 400, "missing_param", "Missing sessionId", requestId);

    const admin = createSupabaseAdmin();

    // Verificar que la sesión pertenece al tenant del profesor
    const { data: sessionRow } = await admin
      .from("tutor_sessions")
      .select("id, student_id, task_id, tenant_id, duration_seconds, needs_help, session_date")
      .eq("id", sessionId)
      .eq("tenant_id", auth.tenant.id)
      .maybeSingle();

    if (!sessionRow) return fail(reply, 404, "not_found", "Session not found", requestId);

    // Encontrar todas las sesiones del mismo alumno+tarea+día para poder buscar
    // la que tenga más pasos (la AI session con steps puede no ser la pasada como param)
    const { data: siblingIds } = await admin
      .from("tutor_sessions")
      .select("id")
      .eq("student_id", sessionRow.student_id)
      .eq("task_id",    sessionRow.task_id)
      .eq("session_date", sessionRow.session_date);

    const allIds = [...new Set([sessionId, ...((siblingIds || []).map(s => s.id))])];

    // Cargar datos en paralelo
    const [
      { data: allMaps },
      { data: messages },
      { data: noteRow },
      { data: studentRow },
      { data: taskRow },
    ] = await Promise.all([
      // Buscar TODOS los mapas para este alumno+tarea+día; elegir el que tenga más pasos
      admin.from("tutor_session_maps")
        .select("session_id, steps, current_step, exercises")
        .in("session_id", allIds),
      admin.from("session_messages")
        .select("role, content, created_at")
        .eq("session_id", sessionId)
        .order("created_at", { ascending: true })
        .limit(200),
      admin.from("student_notes")
        .select("id, note_text, is_read, created_at")
        .in("session_id", allIds)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
      admin.from("students")
        .select("id, display_name")
        .eq("id", sessionRow.student_id)
        .maybeSingle(),
      admin.from("tasks")
        .select("title, subject_name")
        .eq("id", sessionRow.task_id)
        .maybeSingle(),
    ]);

    // Elegir el mapa con más pasos (mejor sesión disponible)
    const mapRow = (allMaps || [])
      .sort((a, b) => (b.steps?.length || 0) - (a.steps?.length || 0))[0] || null;

    return ok(reply, {
      session: {
        id:               sessionRow.id,
        duration_seconds: sessionRow.duration_seconds,
        needs_help:       sessionRow.needs_help,
        session_date:     sessionRow.session_date,
      },
      student:  { id: studentRow?.id || "", name: studentRow?.display_name || "Alumno" },
      task:     { id: sessionRow.task_id, title: taskRow?.title || "", subject_name: taskRow?.subject_name || "" },
      stepMap:  {
        steps:       mapRow?.steps       || [],
        currentStep: mapRow?.current_step ?? 0,
        exercises:   mapRow?.exercises    || [],
      },
      messages: messages || [],
      note:     noteRow  || null,
    }, requestId);
  });
}
