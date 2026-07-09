// Fase 1 (detectar ejercicios) + Fase 2 (generar mapa de pasos) del Agente Guía.
// Extraído de sessionLifecycle.js para que la creación de sesión y el
// reintento automático (sesión ya creada sin documento, adjunto llegado
// después) recorran exactamente el mismo camino de análisis.

import { detectExercises, generateStepMap } from "../agents/guide.js";

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

  // Varios ejercicios → el alumno debe elegir antes de generar pasos (Phase 2 se pospone)
  if (exercises.length > 1) {
    return { exercises, documentText, needsChoice: true, steps: [], guideOk: null };
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

  const steps = guideResult.ok ? guideResult.steps : [];
  return { exercises, documentText, needsChoice: false, steps, guideOk: guideResult.ok };
}
