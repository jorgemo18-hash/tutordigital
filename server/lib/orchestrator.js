// Orquestador de agentes del tutor IA.
// startSession: Phase 1 (detectar ejercicios) + Phase 2 si hay uno solo.
// chooseExercise: Phase 2 cuando el alumno elige un ejercicio concreto.
// handleMessage: diálogo Socrático (Sonnet) con el alumno.

import { detectExercises, generateStepMap, GUIDE_MODEL } from "./agents/guide.js";
import { askAnthropicChat } from "./chat.js";
import { createSupabaseAdmin } from "./supabase.js";

// ── startSession ───────────────────────────────────────────────────────────────
// Devuelve { status: 'needs_choice', sessionId, exercises }
//       o  { status: 'ready', sessionId, steps, currentStep }.

export async function startSession({
  studentId,
  taskId,
  tenantId,
  taskContext = {},   // { title, description, attachments: [{file_name, mime, storage_path}] }
  mode        = "deberes",
  apiKey      = "",
}) {
  const admin = createSupabaseAdmin();

  // 1. Crear registro en tutor_sessions
  const { data: session, error: sessionErr } = await admin
    .from("tutor_sessions")
    .insert({
      student_id:       studentId,
      task_id:          taskId,
      tenant_id:        tenantId,
      duration_seconds: 0,
      needs_help:       false,
      session_date:     new Date().toISOString().slice(0, 10),
    })
    .select("id")
    .single();

  if (sessionErr || !session?.id) {
    throw new Error(`startSession: no se pudo crear tutor_session — ${sessionErr?.message || "unknown"}`);
  }

  const attachments = taskContext.attachments || [];

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
    taskTitle:       taskContext.title       || "",
    taskDescription: taskContext.description || "",
    attachments,
    exerciseIndex:   singleEx?.index  || null,
    exerciseTitle:   singleEx?.title  || "",
    mode,
    apiKey,
  });

  const steps = guideResult.ok ? guideResult.steps : [];

  await admin.from("tutor_session_maps").insert({ ...baseMapRow, steps });

  return { status: "ready", sessionId: session.id, steps, currentStep: 0, guideOk: guideResult.ok };
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
    admin.from("tasks").select("title, description").eq("id", sessionRow.task_id).maybeSingle(),
    admin.from("attachments").select("id, file_name, mime, storage_path, role")
      .eq("owner_type", "task").eq("owner_id", sessionRow.task_id),
  ]);

  // Phase 2 — cache hit del documento de Phase 1
  const guideResult = await generateStepMap({
    taskTitle:       task?.title       || "",
    taskDescription: task?.description || "",
    attachments:     attachmentRows    || [],
    exerciseIndex,
    exerciseTitle,
    mode:            "",
    apiKey,
  });

  const steps        = guideResult.ok ? guideResult.steps : [];
  const documentText = guideResult.extractedText || "";

  const updateRow = { steps, current_step: 0 };
  if (documentText) updateRow.document_text = documentText;

  await admin
    .from("tutor_session_maps")
    .update(updateRow)
    .eq("session_id", sessionId);

  return { steps, currentStep: 0 };
}

// ── handleMessage ──────────────────────────────────────────────────────────────
// Socrático (Sonnet): carga mapa, dialoga, actualiza paso si se completa.

export async function handleMessage({
  validatedData,
  apiKey        = "",
  defaultModel  = "claude-sonnet-4-6",
  onChunk       = null,
}) {
  const admin     = createSupabaseAdmin();
  const sessionId = validatedData.sessionId;

  const { data: mapRow } = await admin
    .from("tutor_session_maps")
    .select("steps, current_step, document_text")
    .eq("session_id", sessionId)
    .maybeSingle();

  const stepMap = mapRow
    ? { steps: mapRow.steps || [], currentStep: mapRow.current_step ?? 0 }
    : null;

  const dataWithMap = {
    ...validatedData,
    stepMap,
    documentText: mapRow?.document_text || "",
  };
  const run         = await askAnthropicChat(dataWithMap, { apiKey, defaultModel, onChunk });

  if (!run.ok) return run;

  if (run.data.stepCompleted && stepMap && stepMap.steps.length > 0) {
    const prevStep   = stepMap.currentStep;
    const nextStep   = Math.min(prevStep + 1, stepMap.steps.length - 1);
    const allDone    = prevStep >= stepMap.steps.length - 1;
    const updatedSteps = stepMap.steps.map((s) =>
      s.index === prevStep ? { ...s, completed: true } : s
    );

    await admin
      .from("tutor_session_maps")
      .update({ current_step: nextStep, steps: updatedSteps })
      .eq("session_id", sessionId);

    run.data.stepMap = { steps: updatedSteps, currentStep: nextStep, allCompleted: allDone };
  }

  if (run.data.escalate?.should) {
    await admin.from("tutor_sessions").update({ needs_help: true }).eq("id", sessionId);
  }

  return run;
}

// ── getSessionMap ──────────────────────────────────────────────────────────────

export async function getSessionMap(sessionId) {
  const admin = createSupabaseAdmin();
  const { data, error } = await admin
    .from("tutor_session_maps")
    .select("steps, current_step")
    .eq("session_id", sessionId)
    .maybeSingle();

  if (error) return { ok: false, error: error.message };
  if (!data)  return { ok: false, error: "not_found" };

  return { ok: true, steps: data.steps || [], currentStep: data.current_step ?? 0 };
}
