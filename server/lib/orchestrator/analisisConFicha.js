// EL ANÁLISIS DE LA HOJA, PASANDO POR LA FICHA COMPARTIDA (fichaDeLaTarea.js).
//
// Mismo resultado que runFullAnalysis (analysis.js) y que la Fase 2 de
// chooseExercise, pero si otro alumno ya preparó esa hoja se lee en vez de
// volver a pagar a Opus. `deps` existe para los tests: en producción son la
// guía de verdad.
import { runFullAnalysis } from "./analysis.js";
import { generateStepMap, GUIDE_MODEL } from "../agents/guide.js";
import { huellaDeLaTarea, leerFicha, guardarEjercicios, pasosGuardados, guardarPasos } from "./fichaDeLaTarea.js";

const GUIA = { analizar: runFullAnalysis, generarPasos: generateStepMap };

// Los pasos de UN ejercicio: de la ficha si ya están; si no, la guía, y se
// guardan para el siguiente. Devuelve lo mismo que generateStepMap.
export async function pasosDelEjercicio({ admin, tenantId, huella, ficha, taskContext, exerciseIndex, exerciseTitle = "", mode = "", apiKey }, deps = GUIA) {
  const guardados = pasosGuardados(ficha, exerciseIndex);
  if (guardados) return { ok: true, steps: guardados, extractedText: ficha.texto_documento || "", model: GUIDE_MODEL, usage: null, deFicha: true };

  const resultado = await deps.generarPasos({
    taskTitle: taskContext.title || "", taskDescription: taskContext.description || "",
    attachments: taskContext.attachments || [], exerciseIndex, exerciseTitle,
    teacherNotes: taskContext.teacherNotes || "", mode, apiKey,
  });
  if (resultado.ok) await guardarPasos(admin, { tenantId, huella, indice: exerciseIndex, pasos: resultado.steps });
  return resultado;
}

export async function analizarConFicha({ admin, tenantId, taskContext, mode = "", apiKey }, deps = GUIA) {
  const huella = await huellaDeLaTarea(admin, taskContext);
  const ficha = await leerFicha(admin, { tenantId, huella });

  if (ficha?.ejercicios?.length) {
    const exercises = ficha.ejercicios;
    const documentText = ficha.texto_documento || "";
    if (exercises.length > 1) {
      return { exercises, documentText, needsChoice: true, steps: [], guideOk: null, usageEvents: [], deFicha: true };
    }
    const unico = exercises[0];
    const r = await pasosDelEjercicio({ admin, tenantId, huella, ficha, taskContext, exerciseIndex: unico.index, exerciseTitle: unico.title, mode, apiKey }, deps);
    const usageEvents = r.usage ? [{ source: "guide_steps", model: r.model || GUIDE_MODEL, usage: r.usage }] : [];
    return { exercises, documentText, needsChoice: false, steps: r.ok ? r.steps : [], guideOk: r.ok, usageEvents, deFicha: true };
  }

  const r = await deps.analizar({
    taskTitle: taskContext.title || "", taskDescription: taskContext.description || "",
    teacherNotes: taskContext.teacherNotes || "", attachments: taskContext.attachments || [], mode, apiKey,
  });
  if (huella && r.detectOk) {
    await guardarEjercicios(admin, { tenantId, huella, ejercicios: r.exercises, textoDocumento: r.documentText });
    if (!r.needsChoice && r.guideOk && r.exercises[0]) {
      await guardarPasos(admin, { tenantId, huella, indice: r.exercises[0].index, pasos: r.steps });
    }
  }
  return r;
}
