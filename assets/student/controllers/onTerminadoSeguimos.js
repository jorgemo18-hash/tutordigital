import { getActiveTaskContext } from "../features/agenda/taskContext.js";
import { apiFetch } from "../../shared/js/auth.js";
import { branchSession, getActiveExercises, getActiveSessionId, getCurrentExerciseIndex } from "../../shared/js/sessionapi.js";
import { showSeguimosPanel } from "../features/seguimosPanel.js";

// Callback "onTerminado" del meta-mode: al terminar una sesión, ofrece
// elegir otro ejercicio de la misma tarea (showSeguimosPanel) y, si el
// alumno elige uno, hace PATCH de la sesión actual + branch a la nueva.
// `getRuntime()` se llama en el momento de ejecutar el handler (no al
// crearlo) para leer el estado más reciente de student.js — varias de estas
// piezas (metaMode, stepMapPanel, exercisePicker, showNotaRow, add...)
// todavía no existen cuando se construye este handler, solo cuando el
// alumno termina una sesión más tarde (mismo motivo por el que student.js
// ya usa el patrón onFinishedRef/addRef en vez de closures directas).
export function createOnTerminadoHandler({ getRuntime, setAutoScrollUnlocked }) {
  return async (kind = "resolved") => {
    const {
      metaMode, onFinishedRef, showTyping, hideTyping, getHistory, setHistory,
      renderFromHistory, exercisePicker, stepMapPanel, ctxSubSteps,
      stepsPlaceholder, sessionLoadingEl, showNotaRow, add,
    } = getRuntime();

    const allExercises = getActiveExercises();
    const chatPaneEl   = document.querySelector(".tutor-chat-pane");

    if (!chatPaneEl) {
      if (kind === "resolved") metaMode.showAgenda();
      await onFinishedRef(kind);
      return;
    }

    // Build completedIndices: DB completed sessions + current in-progress exercise
    let completedIndices = new Set();
    const activeCtx = getActiveTaskContext();
    const taskId    = activeCtx?.id;
    if (taskId && allExercises.length > 0) {
      showTyping();
      try {
        const res  = await apiFetch(`/api/v1/tutor-sessions/task-status/${encodeURIComponent(taskId)}`);
        const body = await res.json().catch(() => ({}));
        (body?.data?.completedIndices || []).forEach((i) => completedIndices.add(i));
      } catch {}
      hideTyping();
    }
    // Mark current exercise as done (it's about to be saved)
    const curIdx = getCurrentExerciseIndex();
    if (curIdx != null) completedIndices.add(curIdx);

    const result = await showSeguimosPanel(chatPaneEl, allExercises, completedIndices);

    if (!result || result.type === "back") {
      if (kind === "resolved") metaMode.showAgenda();
      await onFinishedRef(kind);
      return;
    }

    // El alumno eligió otro ejercicio — PATCH sesión actual, luego branch
    const sessionId = getActiveSessionId();
    if (!sessionId) {
      if (kind === "resolved") metaMode.showAgenda();
      await onFinishedRef(kind);
      return;
    }

    const duration = metaMode.getSessionSeconds?.() || 0;

    // 1. PATCH la sesión AI actual con outcome
    if (taskId && sessionId) {
      try {
        await apiFetch(`/api/v1/tutor-sessions/${encodeURIComponent(sessionId)}`, {
          method:  "PATCH",
          headers: { "Content-Type": "application/json" },
          body:    JSON.stringify({ outcome: kind === "resolved" ? "completed" : "abandoned", duration_seconds: Math.max(1, duration), needs_help: kind === "stuck" }),
        });
      } catch {}
    }

    // 2. Limpiar historial del chat y resetear timer
    metaMode.resetTerminadoUI?.();
    metaMode.resetTimer?.();
    setHistory([]);
    setAutoScrollUnlocked(true);
    try { renderFromHistory?.(); } catch {}

    // 3. Nueva sesión para el ejercicio elegido
    exercisePicker?.hide();
    stepMapPanel.hide();
    if (ctxSubSteps) ctxSubSteps.hidden = false;
    if (stepsPlaceholder) stepsPlaceholder.hidden = false;
    sessionLoadingEl.hidden = false;
    try {
      const branchResult = await branchSession(sessionId, result.exercise.index, result.exercise.title);
      if (ctxSubSteps) ctxSubSteps.hidden = false;
      if (stepsPlaceholder) stepsPlaceholder.hidden = true;
      stepMapPanel.render(branchResult.steps, branchResult.currentStep);
      stepMapPanel.show();
      try { showNotaRow?.(); } catch {}
      const ex = result.exercise;
      const greeting = ex.index
        ? `Vamos con el ejercicio ${ex.index}: ${ex.title || `Ejercicio ${ex.index}`}. ¿Por dónde quieres empezar?`
        : `Vamos con "${ex.title}". ¿Por dónde quieres empezar?`;
      try { add("assistant", greeting); } catch {}
      try { const h = getHistory(); h.push({ role: "assistant", content: greeting }); setHistory(h); } catch {}
    } catch (err) {
      console.error("[seguimos:branchSession]", err?.message);
      metaMode.resetTerminadoUI?.();
    } finally {
      sessionLoadingEl.hidden = true;
    }
  };
}
