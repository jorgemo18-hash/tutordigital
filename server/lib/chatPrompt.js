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

Cuando el alumno demuestre que ha completado el paso actual de forma correcta (no solo un avance parcial), añade [PASO_COMPLETADO] al final de tu respuesta, sin ningún texto después. Si el alumno lleva varios intentos sin poder avanzar, añade [ESCALAR_PROFESOR: motivo breve] al final.`;
}

// ── Main system prompt ─────────────────────────────────────────────────────

export function buildTutorInstructions(modo, taskContext, attemptsSameError, sesion, stepMap = null, documentText = "") {
  const mapSection = buildStepMapSection(stepMap);
  const docSection = documentText
    ? `\nCONTENIDO DEL ENUNCIADO:\n${String(documentText).slice(0, 8000)}\n`
    : "";

  return `Eres un tutor académico para estudiantes españoles de Primaria, ESO y Bachillerato.
${docSection}
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
- Tarea: ${taskContext?.title || "sin título"}
- Intentos mismo error: ${attemptsSameError || 0}`;
}

// ── Response processing ────────────────────────────────────────────────────
// Devuelve { reply, stepCompleted, escalate } en lugar de una string plana.

export function procesarRespuestaTutor(respuesta, _sesionInfo) {
  let reply = String(respuesta || "");
  let stepCompleted = false;
  let escalate = null;

  // Detectar [PASO_COMPLETADO]
  if (/\[PASO_COMPLETADO\]/.test(reply)) {
    stepCompleted = true;
    reply = reply.replace(/\[PASO_COMPLETADO\]/g, "").trim();
  }

  // Detectar [ESCALAR_PROFESOR: motivo]
  const escMatch = reply.match(/\[ESCALAR_PROFESOR:\s*(.+?)\]/);
  if (escMatch) {
    escalate = { should: true, reason: escMatch[1].trim() };
    reply = reply.replace(escMatch[0], "").trim();
  }

  return { reply, stepCompleted, escalate };
}
