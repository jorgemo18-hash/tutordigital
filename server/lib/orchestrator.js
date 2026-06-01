// Orquestador de agentes del tutor IA.
// Coordina el Agente Guía (generación del mapa) y el Agente Socrático (diálogo).

import { generateStepMap } from "./agents/guide.js";
import { askAnthropicChat } from "./chat.js";
import { createSupabaseAdmin } from "./supabase.js";

// ── startSession ───────────────────────────────────────────────────────────
// Crea la sesión en DB, llama al Guía y guarda el mapa de pasos.
// Devuelve { sessionId, steps, currentStep }.

export async function startSession({
  studentId,
  taskId,
  tenantId,
  taskContext = {},
  mode = "deberes",
  exerciseHint = null,
  apiKey = "",
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

  // 2. Llamar al Guía (Opus) para generar el mapa de pasos
  const guideResult = await generateStepMap({
    taskTitle:       taskContext.title || "",
    taskDescription: taskContext.description || "",
    mode,
    exerciseHint,
    apiKey,
  });

  // Si el Guía falla, usamos un mapa vacío y continuamos sin bloquear
  const steps = guideResult.ok ? guideResult.steps : [];
  const guideModel = guideResult.model || null;

  // 3. Guardar mapa en tutor_session_maps
  const { error: mapErr } = await admin
    .from("tutor_session_maps")
    .insert({
      session_id:   session.id,
      steps,
      current_step: 0,
      guide_model:  guideModel,
    });

  if (mapErr) {
    // No es crítico: el chat puede seguir sin mapa
    console.error("[orchestrator.startSession] No se pudo guardar el mapa:", mapErr.message);
  }

  return {
    sessionId:    session.id,
    steps,
    currentStep:  0,
    guideOk:      guideResult.ok,
  };
}

// ── handleMessage ──────────────────────────────────────────────────────────
// Carga el mapa actual, llama al Socrático (Sonnet) con ese contexto,
// actualiza el mapa si el alumno completó un paso, y gestiona el escalado.
// onChunk: callback(token) para streaming SSE — si es null, modo síncrono.

export async function handleMessage({
  validatedData,
  apiKey = "",
  defaultModel = "claude-sonnet-4-6",
  onChunk = null,
}) {
  const admin     = createSupabaseAdmin();
  const sessionId = validatedData.sessionId;

  // 1. Cargar mapa de pasos actual desde DB
  const { data: mapRow } = await admin
    .from("tutor_session_maps")
    .select("steps, current_step")
    .eq("session_id", sessionId)
    .maybeSingle();

  const stepMap = mapRow
    ? { steps: mapRow.steps || [], currentStep: mapRow.current_step ?? 0 }
    : null;

  // 2. Inyectar mapa en los datos y llamar al Socrático
  const dataWithMap = { ...validatedData, stepMap };
  const run = await askAnthropicChat(dataWithMap, { apiKey, defaultModel, onChunk });

  if (!run.ok) return run;

  // 3. Actualizar mapa si el alumno completó el paso actual
  if (run.data.stepCompleted && stepMap && stepMap.steps.length > 0) {
    const prevStep  = stepMap.currentStep;
    const nextStep  = Math.min(prevStep + 1, stepMap.steps.length - 1);
    const allDone   = prevStep >= stepMap.steps.length - 1;

    const updatedSteps = stepMap.steps.map((s) =>
      s.index === prevStep ? { ...s, completed: true } : s
    );

    await admin
      .from("tutor_session_maps")
      .update({ current_step: nextStep, steps: updatedSteps })
      .eq("session_id", sessionId);

    run.data.stepMap = { steps: updatedSteps, currentStep: nextStep, allCompleted: allDone };
  }

  // 4. Marcar needs_help si el Socrático decidió escalar
  if (run.data.escalate?.should) {
    await admin
      .from("tutor_sessions")
      .update({ needs_help: true })
      .eq("id", sessionId);
  }

  return run;
}

// ── getSessionMap ──────────────────────────────────────────────────────────
// Devuelve el mapa actual de una sesión. Usado por GET /session/:id/map.

export async function getSessionMap(sessionId) {
  const admin = createSupabaseAdmin();
  const { data, error } = await admin
    .from("tutor_session_maps")
    .select("steps, current_step")
    .eq("session_id", sessionId)
    .maybeSingle();

  if (error) return { ok: false, error: error.message };
  if (!data)  return { ok: false, error: "not_found" };

  return {
    ok: true,
    steps:       data.steps || [],
    currentStep: data.current_step ?? 0,
  };
}
