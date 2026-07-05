import { getActiveExercises, getActiveSessionId, chooseExercise } from "../../shared/js/sessionapi.js";

// Callback de "Cambiar ejercicio" del panel de pasos — deja elegir otro
// ejercicio de la tarea activa sin salir de la sesión. A diferencia de
// onTerminadoSeguimos.js, esta factory se llama al final del arranque,
// cuando todas sus dependencias ya están inicializadas — no hace falta
// indirección con getters.
export function createChangeExerciseHandler({
  stepMapPanel, stepsPlaceholder, mobileExercisePicker, exercisePicker,
  sessionLoadingEl, showTyping, hideTyping, add, getHistory, setHistory,
}) {
  return async () => {
    const exercises = getActiveExercises();
    if (!exercises?.length) return;
    stepMapPanel.hide();
    if (stepsPlaceholder) stepsPlaceholder.hidden = false;
    const onMobile = window.matchMedia("(max-width: 768px)").matches;
    const chosen = await (onMobile ? mobileExercisePicker : exercisePicker).show(exercises);
    if (!chosen) return;
    const sessionId = getActiveSessionId();
    if (!sessionId) return;
    sessionLoadingEl.hidden = false;
    if (onMobile) showTyping();
    try {
      const mapResult = await chooseExercise(sessionId, chosen.index, chosen.title);
      if (stepsPlaceholder) stepsPlaceholder.hidden = true;
      stepMapPanel.render(mapResult.steps, mapResult.currentStep);
      stepMapPanel.show();
      const greeting = chosen.index
        ? `Vamos con el ejercicio ${chosen.index}: ${chosen.title || `Ejercicio ${chosen.index}`}. ¿Por dónde quieres empezar?`
        : `Vamos con "${chosen.title}". ¿Por dónde quieres empezar?`;
      try { add("assistant", greeting); } catch {}
      try { const h = getHistory(); h.push({ role: "assistant", content: greeting }); setHistory(h); } catch {}
    } catch (err) {
      console.error("[changeExercise]", err?.message);
    } finally {
      sessionLoadingEl.hidden = true;
      if (onMobile) hideTyping();
    }
  };
}
