// handleMessage: diálogo Socrático (Sonnet) con el alumno.

import { askAnthropicChat } from "../chat.js";
import { createSupabaseAdmin } from "../supabase.js";
import { SONNET_MODEL } from "../anthropic.js";

export async function handleMessage({
  validatedData,
  tenantId,
  apiKey        = "",
  defaultModel  = SONNET_MODEL,
  onChunk       = null,
}) {
  const admin     = createSupabaseAdmin();
  const sessionId = validatedData.sessionId;

  // tutor_session_maps no tiene tenant_id propio, se deriva vía
  // session_id -> tutor_sessions.tenant_id. Sin esto, cualquier usuario
  // autenticado que conociera/adivinara un sessionId de otro tenant podía
  // leer y corromper su estado y colar mensajes en su historial (bug de
  // seguridad, corregido 2026-07-07).
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
