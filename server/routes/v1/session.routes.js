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

const BranchSchema = z.object({
  sessionId:     z.string().uuid(),
  exerciseIndex: z.number().int().min(1).max(20),
  exerciseTitle: z.string().max(100).optional().default(""),
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
      admin.from("tasks").select("title, description, teacher_notes")
        .eq("id", taskId).eq("tenant_id", auth.tenant.id).maybeSingle(),
      admin.from("attachments").select("id, file_name, mime, storage_path, role")
        .eq("owner_type", "task").eq("owner_id", taskId),
    ]);

    if (!task) return fail(reply, 404, "task_not_found", "Task not found", requestId);

    const apiKey = getEnv("ANTHROPIC_API_KEY", "");
    if (!apiKey) return fail(reply, 500, "missing_config", "Missing AI configuration", requestId);

    try {
      const result = await startSession({
        studentId:   student.id,
        taskId,
        tenantId:    auth.tenant.id,
        taskContext: {
          title:        task.title         || "",
          description:  task.description   || "",
          teacherNotes: task.teacher_notes || "",
          attachments:  attachmentRows     || [],
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

    return ok(reply, { steps: result.steps, currentStep: result.currentStep, exercises: result.exercises || [] }, requestId);
  });

  // ── GET /api/v1/session/:sessionId/detail ────────────────────────────────
  // Profesor obtiene el detalle completo: pasos + mensajes + nota del alumno.
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
        .in("session_id", allIds)
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

  // ── POST /api/v1/session/branch ───────────────────────────────────────────
  // Cambia a un nuevo ejercicio sin reprocesar el documento (Phase 1 ya hecha).
  // Crea nueva tutor_session, copia exercises del mapa original, ejecuta Phase 2.
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

  // ── GET /api/v1/session/by-task/:taskId?student_id=X ─────────────────────
  // Profesor/admin: historial de sesiones de un alumno para una tarea.
  // Excluye sesiones in_progress sin mensajes reales (huérfanas históricas).
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
