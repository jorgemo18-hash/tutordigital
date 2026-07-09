// startSession: idempotente. Reanuda la sesión activa si existe (resumed:true),
// o crea una nueva. Nunca genera dos sesiones in_progress para el mismo alumno+tarea.
//
// Caso especial (bug sesión libre de academia, 2026-07): una sesión puede
// haberse creado SIN adjuntos (el alumno entra al tutor antes de subir el
// enunciado — la tarea de sesión libre nace vacía). Esa sesión queda
// "muerta": pasos=[], exercises=[]. Si luego el alumno sube el enunciado y
// se vuelve a llamar a startSession (mismo camino, ya sea justo tras la
// subida o al reabrir la tarea), _findActiveSession detecta que ahora SÍ
// hay un adjunto de enunciado y relanza el análisis en vez de servir el
// estado vacío para siempre. El resultado se devuelve sin `resumed:true`
// para que el cliente lo trate como una sesión recién lista (picker + saludo),
// no como una restauración silenciosa.

import { runFullAnalysis } from "./analysis.js";
import { createSupabaseAdmin } from "../supabase.js";
import { GUIDE_MODEL } from "../agents/guide.js";

function statementAttachmentsOf(attachments = []) {
  return attachments.filter((a) => !a.role || a.role === "statement");
}

async function _runAndPersistAnalysis({ admin, sessionId, taskContext, mode, apiKey, hasExistingMap }) {
  const { exercises, documentText, needsChoice, steps, guideOk } = await runFullAnalysis({
    taskTitle:       taskContext.title        || "",
    taskDescription: taskContext.description  || "",
    teacherNotes:    taskContext.teacherNotes || "",
    attachments:     taskContext.attachments  || [],
    mode,
    apiKey,
  });

  const mapRow = {
    steps:         needsChoice ? [] : steps,
    current_step:  0,
    guide_model:   GUIDE_MODEL,
    document_text: documentText,
    exercises,
  };

  if (hasExistingMap) {
    await admin.from("tutor_session_maps").update(mapRow).eq("session_id", sessionId);
  } else {
    await admin.from("tutor_session_maps").insert({ session_id: sessionId, ...mapRow });
  }

  if (needsChoice) return { status: "needs_choice", sessionId, exercises };

  const singleEx = exercises[0] || null;
  if (singleEx?.index != null) {
    await admin.from("tutor_sessions").update({ exercise_index: singleEx.index }).eq("id", sessionId);
  }

  return { status: "ready", sessionId, steps, currentStep: 0, exercises, guideOk };
}

async function _findActiveSession({ admin, studentId, taskId, tenantId, taskContext, mode, apiKey }) {
  const { data: row } = await admin
    .from("tutor_sessions")
    .select("id")
    .eq("student_id", studentId)
    .eq("task_id",    taskId)
    .eq("tenant_id",  tenantId)
    .or("outcome.is.null,outcome.eq.in_progress")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!row) return null;

  const sessionId = row.id;

  const [{ data: mapRow }, { data: messages }] = await Promise.all([
    admin.from("tutor_session_maps")
      .select("steps, current_step, exercises")
      .eq("session_id", sessionId)
      .maybeSingle(),
    admin.from("session_messages")
      .select("role, content, created_at")
      .eq("session_id", sessionId)
      .order("created_at", { ascending: true }),
  ]);

  const steps       = mapRow?.steps     || [];
  const exercises   = mapRow?.exercises || [];
  const currentStep = mapRow?.current_step ?? 0;

  if (steps.length === 0 && exercises.length > 1) {
    return { status: "needs_choice", sessionId, exercises, resumed: true, messages: messages || [] };
  }

  // Sesión sin pasos ni ejercicios: puede ser (a) la tarea aún no tiene
  // adjunto (caso normal, nada que hacer todavía) o (b) ya tiene adjunto
  // pero el análisis nunca corrió o no encontró documento entonces — en
  // ese caso, con el adjunto ya disponible, se relanza.
  if (steps.length === 0 && exercises.length <= 1) {
    const statementAttachments = statementAttachmentsOf(taskContext?.attachments);
    if (statementAttachments.length > 0) {
      return _runAndPersistAnalysis({ admin, sessionId, taskContext, mode, apiKey, hasExistingMap: !!mapRow });
    }
  }

  return {
    status:      "ready",
    sessionId,
    steps,
    currentStep,
    exercises,
    guideOk:    true,
    resumed:    true,
    messages:   messages || [],
  };
}

export async function startSession({
  studentId,
  taskId,
  tenantId,
  taskContext = {},   // { title, description, attachments: [{file_name, mime, storage_path}] }
  mode        = "deberes",
  apiKey      = "",
}) {
  const admin = createSupabaseAdmin();

  // Idempotencia: reanudar sesión activa si existe (o relanzar análisis si estaba muerta)
  const existing = await _findActiveSession({ admin, studentId, taskId, tenantId, taskContext, mode, apiKey });
  if (existing) return existing;

  // 1. Crear registro en tutor_sessions
  const { data: session, error: sessionErr } = await admin
    .from("tutor_sessions")
    .insert({
      student_id:       studentId,
      task_id:          taskId,
      tenant_id:        tenantId,
      duration_seconds: 0,
      needs_help:       false,
      outcome:          "in_progress",
      session_date:     new Date().toISOString().slice(0, 10),
    })
    .select("id")
    .single();

  if (sessionErr || !session?.id) {
    throw new Error(`startSession: no se pudo crear tutor_session — ${sessionErr?.message || "unknown"}`);
  }

  const statementAttachments = statementAttachmentsOf(taskContext.attachments);

  // Guard: sin adjuntos aún no hay documento que analizar → pasos vacíos, placeholder.
  // guide_model queda null a propósito: marca que el análisis nunca llegó a
  // correr (vs. haber corrido y no encontrar ejercicios), aunque la
  // detección de "sesión muerta" de arriba ya no depende de este campo —
  // solo mira si hay adjunto de enunciado disponible.
  if (statementAttachments.length === 0) {
    const emptyMapRow = { session_id: session.id, steps: [], current_step: 0, guide_model: null, document_text: "", exercises: [] };
    await admin.from("tutor_session_maps").insert(emptyMapRow);
    return { status: "ready", sessionId: session.id, steps: [], currentStep: 0, exercises: [], guideOk: false };
  }

  // 2-3. Fase 1 (detectar ejercicios) + Fase 2 si aplica
  return _runAndPersistAnalysis({ admin, sessionId: session.id, taskContext, mode, apiKey, hasExistingMap: false });
}
