import Anthropic from "@anthropic-ai/sdk";

// Agente 1 — El Guía
// Se llama UNA VEZ al abrir una tarea. Usa Opus para descomponer el ejercicio
// en pasos teóricos ordenados y guardarlos en tutor_session_maps.

const GUIDE_MODEL = "claude-opus-4-8";
const MIN_STEPS = 2;
const MAX_STEPS = 7;

function buildGuideSystemPrompt() {
  return `Eres un experto en didáctica que descompone ejercicios académicos en pasos cognitivos para alumnos de Primaria, ESO y Bachillerato españoles.

Tu tarea: analizar el ejercicio indicado y devolver un JSON con los pasos mentales necesarios para resolverlo, en orden lógico.

REGLAS ESTRICTAS:
- Entre ${MIN_STEPS} y ${MAX_STEPS} pasos.
- Cada paso describe UNA acción cognitiva concreta (identificar, aplicar, calcular, comparar…).
- Los pasos son progresivos: cada uno construye sobre el anterior.
- Lenguaje del alumno, claro y directo. Sin jerga académica ni tecnicismos innecesarios.
- NO incluyas números concretos, fórmulas ni la respuesta final.
- Los pasos describen QUÉ hacer mentalmente, no CÓMO hacerlo.

Responde ÚNICAMENTE con JSON válido, sin texto adicional, sin bloques de código, en este formato exacto:
{
  "steps": [
    { "index": 0, "title": "Descripción breve del paso" },
    { "index": 1, "title": "Descripción breve del paso" }
  ]
}`;
}

export async function generateStepMap({
  taskTitle = "",
  taskDescription = "",
  mode = "",
  apiKey = "",
}) {
  if (!apiKey) return { ok: false, error: "missing_api_key" };

  const client = new Anthropic({ apiKey });

  const userPrompt = [
    `Tarea: ${String(taskTitle || "Sin título").trim()}`,
    taskDescription ? `Descripción: ${String(taskDescription).slice(0, 600)}` : null,
    mode ? `Modo de trabajo: ${String(mode).toUpperCase()}` : null,
  ]
    .filter(Boolean)
    .join("\n");

  try {
    const response = await client.messages.create({
      model: GUIDE_MODEL,
      system: buildGuideSystemPrompt(),
      messages: [{ role: "user", content: userPrompt }],
      max_tokens: 600,
    });

    const raw = response.content.find((b) => b.type === "text")?.text || "";

    // Extraer JSON aunque venga envuelto en markdown
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return { ok: false, error: "no_json_in_response", raw };
    }

    let parsed;
    try {
      parsed = JSON.parse(jsonMatch[0]);
    } catch {
      return { ok: false, error: "json_parse_failed", raw };
    }

    const rawSteps = Array.isArray(parsed?.steps) ? parsed.steps : [];
    if (rawSteps.length < MIN_STEPS) {
      return { ok: false, error: "too_few_steps", count: rawSteps.length };
    }

    const steps = rawSteps.slice(0, MAX_STEPS).map((s, i) => ({
      index: i,
      title: String(s?.title || `Paso ${i + 1}`).trim().slice(0, 120),
      completed: false,
    }));

    return {
      ok: true,
      steps,
      model: GUIDE_MODEL,
      usage: response.usage ?? null,
    };
  } catch (err) {
    return {
      ok: false,
      error: err?.error?.type || err?.code || "guide_failed",
      message: err?.message,
    };
  }
}
