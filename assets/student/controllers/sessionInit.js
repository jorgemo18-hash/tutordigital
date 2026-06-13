// sessionInit.js — gestiona el arranque de sesión del tutor IA.
// El backend es siempre la fuente de verdad: startSession es idempotente y
// devuelve la sesión activa existente (resumed:true) o crea una nueva.
// Esto garantiza continuidad cross-device sin depender de localStorage.

export async function initSession(taskId, mode, deps = {}) {
  const {
    startSessionFn,
    onSessionReady,
    showSessionLoading,
    hideSessionLoading,
    showExercisePicker,
    chooseExerciseFn,
  } = deps;

  if (typeof startSessionFn !== "function") return;

  // Leer contexto de ejercicio previo del cache local (solo para needs_choice)
  let _priorExCtx = null;
  try {
    const _raw = localStorage.getItem(`ttd_session_${taskId}`);
    if (_raw?.startsWith("{")) {
      const _p = JSON.parse(_raw);
      if (_p.exerciseIndex != null) _priorExCtx = { index: _p.exerciseIndex, title: _p.exerciseTitle || "" };
    }
  } catch {}

  showSessionLoading?.();
  try {
    const result = await startSessionFn(taskId, mode || "deberes");

    if (result.resumed) {
      // Backend devolvió sesión existente — cross-device o misma sesión confirmada
      if (result.status === "needs_choice" && (result.exercises?.length ?? 0) > 1) {
        // Ejercicio nunca elegido — mostrar picker y actualizar la sesión existente
        hideSessionLoading?.();
        const chosen =
          _priorExCtx ||
          (typeof showExercisePicker === "function" ? await showExercisePicker(result.exercises) : null);
        if (!chosen) return;
        showSessionLoading?.();
        if (typeof chooseExerciseFn === "function") {
          const mapResult = await chooseExerciseFn(result.sessionId, chosen.index, chosen.title);
          const _chosenCtx = { ...chosen, totalCount: result.exercises?.length ?? 1 };
          onSessionReady?.(mapResult?.steps ?? [], mapResult?.currentStep ?? 0, _chosenCtx, false);
        }
        return;
      }
      // Sesión ready — restaurar con mensajes del backend (hidratación cross-device)
      const _ex = result.exercises?.[0] ?? null;
      const exerciseCtx = _ex ? { ..._ex, totalCount: result.exercises.length } : null;
      onSessionReady?.(result.steps ?? [], result.currentStep ?? 0, exerciseCtx, true, result.messages ?? []);
      return;
    }

    // Sesión nueva creada
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
        const _chosenCtx = { ...chosen, totalCount: result.exercises?.length ?? 1 };
        onSessionReady?.(mapResult?.steps ?? [], mapResult?.currentStep ?? 0, _chosenCtx, false);
      }
    } else {
      const singleEx = result.exercises?.[0] ?? null;
      const singleCtx = singleEx ? { ...singleEx, totalCount: result.exercises.length } : null;
      onSessionReady?.(result.steps ?? [], result.currentStep ?? 0, singleCtx, false);
    }
  } catch (err) {
    console.error("[sessionInit] Fallo:", err?.message);
  } finally {
    hideSessionLoading?.();
  }
}
