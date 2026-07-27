// Fase 1 (detectar ejercicios) + Fase 2 (generar mapa de pasos) del Agente Guía.
// Extraído de sessionLifecycle.js para que la creación de sesión y el
// reintento automático (sesión ya creada sin documento, adjunto llegado
// después) recorran exactamente el mismo camino de análisis.

import { detectExercises, generateStepMap, GUIDE_MODEL } from "../agents/guide.js";

export async function runFullAnalysis({
  taskTitle       = "",
  taskDescription = "",
  teacherNotes    = "",
  attachments     = [],
  mode            = "",
  apiKey          = "",
}) {
  const detectResult = await detectExercises({ taskTitle, taskDescription, attachments, apiKey });
  const exercises     = detectResult.exercises     || [];
  const documentText  = detectResult.extractedText || "";

  // usageEvents: 0-2 llamadas reales a Claude según hasta dónde llegue este
  // análisis — el caller (sessionLifecycle.js) las persiste en
  // ai_token_usage. GUIDE_MODEL en vez de detectResult.model/guideResult.model
  // porque ninguna de las dos funciones de guide.js devuelve el modelo usado
  // en Fase 1 (solo Fase 2 lo hace) — mismo modelo para ambas fases de todos modos.
  const usageEvents = [];
  if (detectResult.usage) usageEvents.push({ source: "guide_detect", model: GUIDE_MODEL, usage: detectResult.usage });

  // Varios ejercicios → el alumno debe elegir antes de generar pasos (Phase 2 se pospone)
  if (exercises.length > 1) {
    return { exercises, documentText, needsChoice: true, steps: [], guideOk: null, usageEvents };
  }

  // Cero o un ejercicio → Phase 2 inmediata
  const singleEx    = exercises[0] || null;
  const guideResult = await generateStepMap({
    taskTitle,
    taskDescription,
    attachments,
    exerciseIndex: singleEx?.index || null,
    exerciseTitle: singleEx?.title || "",
    teacherNotes,
    mode,
    apiKey,
  });
  if (guideResult.usage) usageEvents.push({ source: "guide_steps", model: guideResult.model || GUIDE_MODEL, usage: guideResult.usage });

  const steps = guideResult.ok ? guideResult.steps : [];
  return { exercises, documentText, needsChoice: false, steps, guideOk: guideResult.ok, usageEvents };
}
