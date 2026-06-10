export async function initSession(taskId, mode, deps = {}) {
  const { 
    startSessionFn, 
    restoreSessionFn, 
    onSessionReady, 
    showSessionLoading, 
    hideSessionLoading, 
    showExercisePicker, 
    chooseExerciseFn 
  } = deps;

  if (typeof startSessionFn !== "function") return;

  let _priorExCtx = null;
  try {
    const _raw = localStorage.getItem(`ttd_session_${taskId}`);
    if (_raw?.startsWith("{")) {
      const _p = JSON.parse(_raw);
      if (_p.exerciseIndex != null) _priorExCtx = { index: _p.exerciseIndex, title: _p.exerciseTitle || "" };
    }
  } catch {}

  if (typeof restoreSessionFn === "function") {
    try {
      const restored = await restoreSessionFn(taskId);
      if (restored) {
        onSessionReady?.(restored.steps, restored.currentStep, restored.exerciseCtx ?? null, true);
        return;
      }
    } catch {}
  }

  showSessionLoading?.();
  try {
    const result = await startSessionFn(taskId, mode || "deberes");

    if (result.status === "needs_choice" && (result.exercises?.length ?? 0) > 1) {
      hideSessionLoading?.();

      let chosen = _priorExCtx || null;
      if (!chosen && typeof showExercisePicker === "function") {
        chosen = await showExercisePicker(result.exercises);
      }

      if (!chosen) return;

      showSessionLoading?.();
      if (typeof chooseExerciseFn === "function") {
        const mapResult = await chooseExerciseFn(result.sessionId, chosen.index, chosen.title);
        onSessionReady?.(mapResult?.steps ?? [], mapResult?.currentStep ?? 0, chosen, false);
      }
    } else {
      const singleEx = result.exercises?.[0] ?? null;
      onSessionReady?.(result.steps ?? [], result.currentStep ?? 0, singleEx, false);
    }
  } catch (err) {
    console.error("[sessionInit] Fallo:", err?.message);
  } finally {
    hideSessionLoading?.();
  }
}