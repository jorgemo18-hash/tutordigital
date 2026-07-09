// chooseExercise: Phase 2 cuando el alumno elige un ejercicio concreto.
// Reutiliza el documento cacheado en Phase 1 vía prompt caching de Anthropic.

import { generateStepMap } from "../agents/guide.js";
import { createSupabaseAdmin } from "../supabase.js";

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
  const documentText  = guideResult.extractedText || "";

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
