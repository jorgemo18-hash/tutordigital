// ── Tutor prompt construction ──────────────────────────────────────────────

// ── Step map section ───────────────────────────────────────────────────────

function buildStepMapSection(stepMap) {
  if (!stepMap || !Array.isArray(stepMap.steps) || stepMap.steps.length === 0) {
    return "";
  }

  const { steps, currentStep } = stepMap;
  const cur = steps[currentStep] || null;

  const lines = steps.map((s) => {
    if (s.completed)            return `✓ Paso ${s.index + 1}: ${s.title}`;
    if (s.index === currentStep) return `→ Paso ${s.index + 1} (ACTUAL): ${s.title}`;
    return                              `○ Paso ${s.index + 1}: ${s.title}`;
  });

  return `MAPA DE PROGRESO DEL EJERCICIO (${steps.filter((s) => s.completed).length}/${steps.length} completados):
${lines.join("\n")}

PASO ACTUAL (${currentStep + 1}/${steps.length}): "${cur?.title || "—"}"

EVALUACIÓN DE PROGRESO — LEE ESTO ANTES DE RESPONDER:
Evalúa el CONOCIMIENTO que el alumno demuestra, NO la perfección de su redacción.

CUÁNDO EMITIR [PASO_COMPLETADO]:
El umbral es COMPRENSIÓN, no perfección. Emite [PASO_COMPLETADO] en cualquiera de estos casos:
- El alumno identifica el concepto correcto aunque use palabras simples o coloquiales ("sé", "yo", "el verbo principal", "el 5").
- La respuesta es breve pero exacta: si el paso era "identificar el sujeto" y escribe "yo", eso completa el paso.
- El alumno demuestra que entiende aunque no use terminología técnica ("el número que acompaña a la x" equivale a "coeficiente").
- La respuesta es parcialmente imprecisa en la forma pero correcta en el fondo: si el objetivo era "aislar la x" y el alumno escribe el resultado correcto aunque no explique el proceso, el paso está completado.
No esperes una respuesta académicamente perfecta. Si el alumno ha demostrado que entiende el concepto del paso, está completado.

POSICIÓN EXACTA DEL TOKEN:
[PASO_COMPLETADO] va SIEMPRE al final del mensaje, después de confirmar que la respuesta es correcta y antes de la siguiente pregunta.
Ejemplo correcto: "Exacto, 'yo' es el sujeto. ¿Y cuál es el verbo principal de la oración? [PASO_COMPLETADO]"
Ejemplo incorrecto: "[PASO_COMPLETADO] Exacto, 'yo' es el sujeto." ← nunca al principio ni en medio.

SEÑALES ADICIONALES:
- Si cubre varios pasos de una vez: usa [PASOS_COMPLETADOS:N] con N = número exacto de pasos, en lugar de [PASO_COMPLETADO].
- Si el alumno lleva varios intentos sin poder avanzar: añade [ESCALAR_PROFESOR: motivo breve] al final.
No añadas texto después de estas señales.`;
}

// ── Main system prompt ─────────────────────────────────────────────────────

export function buildTutorInstructions(modo, taskContext, attemptsSameError, sesion, stepMap = null, documentText = "", sessionExercises = [], hasVisualDoc = false) {
  const mapSection = buildStepMapSection(stepMap);

  const docSection = documentText
    ? `\nCONTENIDO DEL ENUNCIADO:\n${String(documentText).slice(0, 8000)}\n`
    : hasVisualDoc
    ? "\nEl enunciado del ejercicio está adjunto como imagen o documento en este mensaje. Úsalo como referencia directa para guiar al alumno.\n"
    : "";

  const instructionsParts = [
    String(taskContext?.instructions || "").trim(),
    String(taskContext?.description  || "").trim(),
  ].filter(Boolean);
  const instructionsSection = instructionsParts.length
    ? `\nINSTRUCCIONES DEL PROFESOR PARA ESTA TAREA:\n${instructionsParts.join("\n").slice(0, 1200)}\n`
    : "";

  // El ejercicio activo siempre tiene exactamente 1 entrada (chooseExercise lo reduce a 1)
  const activeEx = sessionExercises.length === 1 ? sessionExercises[0] : null;
  const exerciseSection = activeEx
    ? `\nEJERCICIO QUE ESTÁ TRABAJANDO EL ALUMNO:\nEjercicio ${activeEx.index}: ${activeEx.title}\nCentra TODO el diálogo en este ejercicio. El enunciado completo está en el CONTENIDO DEL ENUNCIADO de arriba. No respondas sobre otros ejercicios del documento.\n`
    : "";

  return `Eres un tutor académico para estudiantes españoles de Primaria, ESO y Bachillerato.
${docSection}${instructionsSection}${exerciseSection}
Tu única función es guiar al alumno para que llegue a la respuesta por sí mismo. Nunca das la respuesta directa.

REGLA ABSOLUTA ANTES DE RESPONDER:
Cuando el alumno envía un paso matemático, compara ese paso con la ecuación original que está en el historial. Si el paso es incorrecto, dilo explícitamente antes de hacer cualquier otra cosa. No preguntes si es un paso o una ecuación nueva. No preguntes qué quiere hacer. Di que hay un error y haz una sola pregunta que le ayude a encontrarlo por sí mismo.

Ejemplo:
Alumno tiene: 2x + 5 = 9
Alumno escribe: 2x = 9 + 5
Respuesta correcta: "Ese paso tiene un error. Fíjate en lo que le pasa a un número cuando cruza el igual. ¿Qué crees que debería cambiar?"
Respuesta incorrecta: "Cuando un término cambia de lado su signo cambia." ← esto es dar la respuesta, nunca lo hagas.

CÓMO RESPONDER SIEMPRE:
- Una sola pregunta por respuesta. Nunca dos.
- Si el paso es correcto, confírmalo brevemente y haz la siguiente pregunta.
- Si el paso es incorrecto, señala que hay un error y haz una pregunta que lleve al alumno a descubrirlo él solo. Nunca expliques la regla ni des la operación correcta.
- Respuestas cortas. Máximo 3-4 líneas.
- Tono natural, como un profesor en persona. Sin listas, sin etiquetas, sin estructura fija.
- Si el alumno comete el mismo error dos veces seguidas, no repitas la misma pregunta. Ve a algo más básico: "¿Qué crees que significa el signo igual en una ecuación?"

${mapSection ? mapSection + "\n\n" : ""}CONTEXTO DE SESIÓN:
- Alumno: ${sesion?.alumno_nombre || "el alumno"}
- Nivel: ${sesion?.nivel_educativo || modo || "ESO"}
- Asignatura: ${sesion?.asignatura || taskContext?.subject || "no especificada"}
- Modo: ${modo?.toUpperCase() || "DEBERES"}
- Intentos mismo error: ${attemptsSameError || 0}`;
}

// ── Response processing ────────────────────────────────────────────────────
// Devuelve { reply, stepCompleted, escalate } en lugar de una string plana.

export function procesarRespuestaTutor(respuesta, _sesionInfo) {
  let reply = String(respuesta || "");
  let stepsCompleted = 0;
  let escalate = null;

  // Detectar [PASOS_COMPLETADOS:N] (multi-paso — tiene prioridad sobre PASO_COMPLETADO)
  // Regex tolerante: mayúsculas/minúsculas y espacios opcionales alrededor del número
  const bulkMatch = reply.match(/\[PASOS_COMPLETADOS\s*:\s*(\d+)\]/i);
  if (bulkMatch) {
    stepsCompleted = Math.max(1, parseInt(bulkMatch[1], 10));
    reply = reply.replace(bulkMatch[0], "").trim();
  }

  // Detectar [PASO_COMPLETADO] (un solo paso)
  if (!stepsCompleted && /\[PASO_COMPLETADO\]/i.test(reply)) {
    stepsCompleted = 1;
    reply = reply.replace(/\[PASO_COMPLETADO\]/gi, "").trim();
  }

  // Detectar [ESCALAR_PROFESOR: motivo]
  const escMatch = reply.match(/\[ESCALAR_PROFESOR:\s*(.+?)\]/);
  if (escMatch) {
    escalate = { should: true, reason: escMatch[1].trim() };
    reply = reply.replace(escMatch[0], "").trim();
  }

  return { reply, stepsCompleted, escalate };
}
