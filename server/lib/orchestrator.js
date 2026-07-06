// Orquestador de agentes del tutor IA.
// startSession: Phase 1 (detectar ejercicios) + Phase 2 si hay uno solo.
// chooseExercise: Phase 2 cuando el alumno elige un ejercicio concreto.
// handleMessage: diálogo Socrático (Sonnet) con el alumno.

import { detectExercises, generateStepMap, GUIDE_MODEL } from "./agents/guide.js";
import { askAnthropicChat } from "./chat.js";
import { createSupabaseAdmin } from "./supabase.js";
import { SONNET_MODEL } from "./anthropic.js";

// ── _findActiveSession ─────────────────────────────────────────────────────────
// Busca una sesión activa (outcome IS NULL o 'in_progress') para student+task+tenant.
// Si hay varias por el bug histórico, devuelve la más reciente y las demás se ignoran.
// Incluye session_messages para hidratación cross-device en el cliente.

async function _findActiveSession({ admin, studentId, taskId, tenantId }) {
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

// ── startSession ───────────────────────────────────────────────────────────────
// Idempotente: devuelve la sesión activa existente si la hay (resumed: true),
// o crea una nueva. Nunca genera dos sesiones in_progress para el mismo alumno+tarea.
// Devuelve { status: 'needs_choice'|'ready', sessionId, …, resumed?: true, messages?: [] }.

export async function startSession({
  studentId,
  taskId,
  tenantId,
  taskContext = {},   // { title, description, attachments: [{file_name, mime, storage_path}] }
  mode        = "deberes",
  apiKey      = "",
}) {
  const admin = createSupabaseAdmin();

  // Idempotencia: reanudar sesión activa si existe
  const existing = await _findActiveSession({ admin, studentId, taskId, tenantId });
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

  const attachments = taskContext.attachments || [];

  // Guard: sin adjuntos del profesor no hay documento que analizar → pasos vacíos, placeholder
  const statementAttachments = attachments.filter((a) => !a.role || a.role === "statement");
  if (statementAttachments.length === 0) {
    const emptyMapRow = { session_id: session.id, steps: [], current_step: 0, guide_model: GUIDE_MODEL, document_text: "", exercises: [] };
    await admin.from("tutor_session_maps").insert(emptyMapRow);
    return { status: "ready", sessionId: session.id, steps: [], currentStep: 0, exercises: [], guideOk: false };
  }

  // 2. Phase 1 — Guía detecta cuántos ejercicios hay en el documento
  const detectResult = await detectExercises({
    taskTitle:       taskContext.title       || "",
    taskDescription: taskContext.description || "",
    attachments,
    apiKey,
  });

  const exercises     = detectResult.exercises     || [];
  const documentText  = detectResult.extractedText || "";

  // Columnas base del mapa (exercises puede no existir si la migración 044 no está aplicada)
  const baseMapRow = { session_id: session.id, steps: [], current_step: 0, guide_model: GUIDE_MODEL, document_text: documentText };
  try { baseMapRow.exercises = exercises; } catch {}

  // 3a. Múltiples ejercicios → el alumno debe elegir (Phase 2 se pospone)
  if (exercises.length > 1) {
    await admin.from("tutor_session_maps").insert(baseMapRow);
    return { status: "needs_choice", sessionId: session.id, exercises };
  }

  // 3b. Un solo ejercicio → Phase 2 inmediata
  const singleEx    = exercises[0] || null;
  const guideResult = await generateStepMap({
    taskTitle:       taskContext.title        || "",
    taskDescription: taskContext.description  || "",
    attachments,
    exerciseIndex:   singleEx?.index  || null,
    exerciseTitle:   singleEx?.title  || "",
    teacherNotes:    taskContext.teacherNotes || "",
    mode,
    apiKey,
  });

  const steps = guideResult.ok ? guideResult.steps : [];

  await admin.from("tutor_session_maps").insert({ ...baseMapRow, steps });

  if (singleEx?.index != null) {
    await admin.from("tutor_sessions").update({ exercise_index: singleEx.index }).eq("id", session.id);
  }

  return { status: "ready", sessionId: session.id, steps, currentStep: 0, exercises, guideOk: guideResult.ok };
}

// ── chooseExercise ─────────────────────────────────────────────────────────────
// Phase 2 cuando el alumno elige un ejercicio concreto.
// Reutiliza el documento cacheado en Phase 1 via prompt caching de Anthropic.

export async function chooseExercise({ sessionId, exerciseIndex, exerciseTitle = "", apiKey = "" }) {
  const admin = createSupabaseAdmin();

  // Obtener task_id desde la sesión
  const { data: sessionRow } = await admin
    .from("tutor_sessions")
    .select("task_id")
    .eq("id", sessionId)
    .maybeSingle();

  if (!sessionRow) throw new Error("chooseExercise: session not found");

  // Obtener contexto de la tarea + adjuntos (role=statement primero, fallback a todos)
  const [{ data: task }, { data: attachmentRows }] = await Promise.all([
    admin.from("tasks").select("title, description, teacher_notes").eq("id", sessionRow.task_id).maybeSingle(),
    admin.from("attachments").select("id, file_name, mime, storage_path, role")
      .eq("owner_type", "task").eq("owner_id", sessionRow.task_id),
  ]);

  // Phase 2 — cache hit del documento de Phase 1
  const guideResult = await generateStepMap({
    taskTitle:       task?.title         || "",
    taskDescription: task?.description   || "",
    attachments:     attachmentRows      || [],
    exerciseIndex,
    exerciseTitle,
    teacherNotes:    task?.teacher_notes || "",
    mode:            "",
    apiKey,
  });

  const steps        = guideResult.ok ? guideResult.steps : [];
  const documentText = guideResult.extractedText || "";

  const updateRow = { steps, current_step: 0 };
  if (documentText) updateRow.document_text = documentText;
  // Reducir exercises al único ejercicio elegido para que handleMessage
  // sepa exactamente qué ejercicio trabaja el alumno.
  updateRow.exercises = [{ index: exerciseIndex, title: exerciseTitle }];

  await admin
    .from("tutor_session_maps")
    .update(updateRow)
    .eq("session_id", sessionId);

  await admin.from("tutor_sessions").update({ exercise_index: exerciseIndex }).eq("id", sessionId);

  return { steps, currentStep: 0 };
}

// ── handleMessage ──────────────────────────────────────────────────────────────
// Socrático (Sonnet): carga mapa, dialoga, actualiza paso si se completa.

export async function handleMessage({
  validatedData,
  tenantId,
  apiKey        = "",
  defaultModel  = SONNET_MODEL,
  onChunk       = null,
}) {
  const admin     = createSupabaseAdmin();
  const sessionId = validatedData.sessionId;

  // Mismo patrón que getSessionMap (más abajo) — tutor_session_maps no tiene
  // tenant_id propio, se deriva vía session_id -> tutor_sessions.tenant_id.
  // Sin esto, cualquier usuario autenticado que conociera/adivinara un
  // sessionId de otro tenant podía leer y corromper su estado y colar
  // mensajes en su historial (bug de seguridad, corregido 2026-07-07).
  const { data: sessionRow, error: sessionErr } = await admin
    .from("tutor_sessions")
    .select("id")
    .eq("id", sessionId)
    .eq("tenant_id", tenantId)
    .maybeSingle();
  if (sessionErr) return { ok: false, code: "session_lookup_failed", message: sessionErr.message };
  if (!sessionRow) return { ok: false, code: "forbidden", message: "Session not found for this tenant" };

  const { data: mapRow } = await admin
    .from("tutor_session_maps")
    .select("steps, current_step, document_text, exercises, messages_without_progress, completion_reminded")
    .eq("session_id", sessionId)
    .maybeSingle();

  const stepMap = mapRow
    ? { steps: mapRow.steps || [], currentStep: mapRow.current_step ?? 0 }
    : null;

  const documentText          = mapRow?.document_text || "";
  const sessionExercises      = Array.isArray(mapRow?.exercises) ? mapRow.exercises : [];
  const prevMsgWithoutProgress = mapRow?.messages_without_progress ?? 0;
  const completionReminded    = mapRow?.completion_reminded ?? false;

  const dataWithMap = {
    ...validatedData,
    stepMap,
    documentText,
    sessionExercises,
  };
  const run         = await askAnthropicChat(dataWithMap, { apiKey, defaultModel, onChunk });

  if (!run.ok) return run;

  const stepsCompleted = run.data.stepsCompleted ?? 0;
  if (stepsCompleted > 0 && stepMap && stepMap.steps.length > 0) {
    const prevStep     = stepMap.currentStep;
    const lastIdx      = stepMap.steps.length - 1;
    const completedTo  = Math.min(prevStep + stepsCompleted - 1, lastIdx);
    const nextStep     = Math.min(prevStep + stepsCompleted,     lastIdx);
    const allDone      = completedTo >= lastIdx;

    const updatedSteps = stepMap.steps.map((s) =>
      s.index >= prevStep && s.index <= completedTo ? { ...s, completed: true } : s
    );

    await admin
      .from("tutor_session_maps")
      .update({ current_step: nextStep, steps: updatedSteps })
      .eq("session_id", sessionId);

    run.data.stepMap = { steps: updatedSteps, currentStep: nextStep, allCompleted: allDone };
  }

  if (run.data.escalate?.should) {
    await admin.from("tutor_sessions").update({
      needs_help:        true,
      outcome:           "escalated",
      escalation_reason: run.data.escalate.reason || null,
    }).eq("id", sessionId);
  }

  // ── Recordatorios Socráticos ───────────────────────────────────────────────
  // Appended to the reply after the model finishes; streamed as extra tokens by the route.
  if (run.ok && stepMap && stepMap.steps.length > 0) {
    let reminderText = null;
    let newMsgWithoutProgress = prevMsgWithoutProgress;
    let newCompletionReminded = completionReminded;

    const allDone = run.data.stepMap?.allCompleted ?? false;

    if (allDone && !completionReminded) {
      reminderText = "\n\nHas completado todos los pasos de este ejercicio. Cuando quieras, pulsa 'He terminado' para cerrarlo.";
      newCompletionReminded = true;
      newMsgWithoutProgress = 0;
    } else if (stepsCompleted > 0) {
      newMsgWithoutProgress = 0;
    } else {
      newMsgWithoutProgress = prevMsgWithoutProgress + 1;
      if (newMsgWithoutProgress > 0 && newMsgWithoutProgress % 4 === 0) {
        reminderText = "\n\nSi sigues teniendo dificultades con este paso, puedes pulsar 'No he podido' para que tu profesor lo revise contigo.";
      }
    }

    await admin.from("tutor_session_maps").update({
      messages_without_progress: newMsgWithoutProgress,
      completion_reminded:       newCompletionReminded,
    }).eq("session_id", sessionId);

    if (reminderText) {
      run.data.reminder = reminderText;
      run.data.reply    = (run.data.reply || "") + reminderText;
    }
  }

  // Persistir mensajes para el historial (fire-and-forget con un retry)
  if (run.ok && sessionId && run.data?.reply) {
    const fileName = validatedData.fileName || validatedData.file_name || "";
    const rawText  = String(validatedData.text || "").trim();
    const uText    = (rawText || (fileName ? `[Archivo: ${fileName}]` : "[Adjunto]")).slice(0, 10_000);
    const aText    = String(run.data.reply || "").slice(0, 10_000);
    const rows     = [
      { session_id: sessionId, role: "user",      content: uText },
      { session_id: sessionId, role: "assistant", content: aText },
    ];

    const doInsert = () => admin.from("session_messages").insert(rows);

    doInsert().then(({ error }) => {
      if (!error) return;
      // Un único retry tras 500 ms
      setTimeout(() => {
        doInsert().then(({ error: e2 }) => {
          if (e2) {
            console.error("[orchestrator] session_messages insert failed after retry", {
              sessionId,
              errorCode:    e2.code,
              errorMessage: e2.message,
            });
          }
        });
      }, 500);
    });
  }

  return run;
}

// ── getSessionMap ──────────────────────────────────────────────────────────────

// `tenantId` es obligatorio: tutor_session_maps no tiene tenant_id propio (se
// deriva vía session_id -> tutor_sessions.tenant_id) — sin validar esto,
// cualquier usuario autenticado que conociera/adivinara un sessionId de otro
// tenant podía leer sus pasos/ejercicios (bug de seguridad, corregido 2026-07-05).
export async function getSessionMap(sessionId, tenantId) {
  const admin = createSupabaseAdmin();

  const { data: sessionRow, error: sessionErr } = await admin
    .from("tutor_sessions")
    .select("id")
    .eq("id", sessionId)
    .eq("tenant_id", tenantId)
    .maybeSingle();
  if (sessionErr) return { ok: false, error: sessionErr.message };
  if (!sessionRow) return { ok: false, error: "forbidden" };

  const { data, error } = await admin
    .from("tutor_session_maps")
    .select("steps, current_step, exercises")
    .eq("session_id", sessionId)
    .maybeSingle();

  if (error) return { ok: false, error: error.message };
  if (!data)  return { ok: false, error: "not_found" };

  return {
    ok:          true,
    steps:       data.steps       || [],
    currentStep: data.current_step ?? 0,
    exercises:   data.exercises    || [],
  };
}
