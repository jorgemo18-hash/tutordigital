// Agente 1 — El Guía (Opus)
// Dos fases: detectar ejercicios del documento → generar mapa de pasos.
// El documento se cachea en Phase 1 y se reutiliza en Phase 2 via prompt caching.

import Anthropic from "@anthropic-ai/sdk";
import mammoth from "mammoth";
import pdfParse from "pdf-parse";
import { createSupabaseAdmin } from "../supabase.js";

export const GUIDE_MODEL = "claude-opus-4-8";
const MIN_STEPS = 2;
const MAX_STEPS = 7;
const BUCKET    = "task-attachments";

// ── Carga de documentos desde Supabase Storage ────────────────────────────────
// Descarga cada adjunto, extrae texto (PDF/DOCX) o base64 (imagen) y devuelve
// bloques Anthropic listos para usar. El último bloque se marca con cache_control
// para que Phase 2 reutilice el prefijo cacheado.

async function buildDocumentBlocks(attachments = []) {
  if (!attachments.length) return [];
  const admin  = createSupabaseAdmin();
  const blocks = [];

  for (const att of attachments) {
    const storagePath = att.storage_path || att.storagePath || "";
    const fileName    = att.file_name    || att.fileName    || "archivo";
    const mime        = String(att.mime  || "").toLowerCase();
    if (!storagePath) continue;

    try {
      const { data: blob, error } = await admin.storage.from(BUCKET).download(storagePath);
      if (error || !blob) continue;

      const buf  = Buffer.from(await blob.arrayBuffer());
      const ext  = String(fileName).toLowerCase().split(".").pop();
      const isPDF    = mime === "application/pdf"                                    || ext === "pdf";
      const isDocx   = mime.includes("wordprocessingml")                             || ext === "docx";
      const isImage  = mime.startsWith("image/");

      if (isPDF) {
        let text = "";
        try { text = String((await pdfParse(buf))?.text || "").replace(/\r/g, "").trim(); } catch {}
        if (text) blocks.push({ type: "text", text: `[Documento: ${fileName}]\n\n${text.slice(0, 100_000)}` });

      } else if (isDocx) {
        let text = "";
        try { text = String((await mammoth.extractRawText({ buffer: buf }))?.value || "").replace(/\r/g, "").trim(); } catch {}
        if (text) blocks.push({ type: "text", text: `[Documento: ${fileName}]\n\n${text.slice(0, 100_000)}` });

      } else if (isImage) {
        blocks.push({ type: "image", source: { type: "base64", media_type: mime || "image/jpeg", data: buf.toString("base64") } });
      }
    } catch {}
  }

  // Marca el último bloque para prompt caching (Phase 2 reutiliza este prefijo)
  if (blocks.length > 0) {
    blocks[blocks.length - 1].cache_control = { type: "ephemeral" };
  }

  return blocks;
}

// ── Phase 1: Detectar ejercicios ──────────────────────────────────────────────
// Llama al Guía con el documento y devuelve la lista de ejercicios encontrados.
// Si detecta uno solo, el caller pasa directo a Phase 2 sin mostrar el selector.

const DETECT_SYSTEM = `Eres un analizador de documentos académicos españoles. Tu tarea es identificar y listar todos los ejercicios, problemas o preguntas del documento.

Responde ÚNICAMENTE con JSON válido, sin texto adicional:
{
  "exercises": [
    { "index": 1, "title": "Título breve del ejercicio (máx. 60 caracteres)" }
  ]
}

REGLAS:
- Lista todos los ejercicios numerados. Si no hay numeración clara o el documento es un solo ejercicio, devuelve un array con un único elemento.
- Los títulos deben ser breves (máx. 60 caracteres) y capturar la idea principal del ejercicio.
- Indexa desde 1.
- No incluyas texto fuera del JSON.`;

export async function detectExercises({ taskTitle = "", taskDescription = "", attachments = [], apiKey = "" }) {
  const fallback = [{ index: 1, title: String(taskTitle || "El ejercicio").trim().slice(0, 60) }];
  if (!apiKey) return { ok: false, error: "missing_api_key", exercises: fallback };

  const client    = new Anthropic({ apiKey });
  const docBlocks = await buildDocumentBlocks(attachments);

  const userContent = [
    ...docBlocks,
    {
      type: "text",
      text: [
        taskTitle        ? `Tarea: ${taskTitle}`                          : null,
        taskDescription  ? `Descripción: ${taskDescription.slice(0, 400)}` : null,
        docBlocks.length ? "Identifica y lista todos los ejercicios del documento adjunto." : "Identifica los ejercicios a partir del título y descripción.",
      ].filter(Boolean).join("\n"),
    },
  ];

  try {
    const response = await client.messages.create({
      model:     GUIDE_MODEL,
      system:    DETECT_SYSTEM,
      messages:  [{ role: "user", content: userContent }],
      max_tokens: 400,
    });

    const raw       = response.content.find((b) => b.type === "text")?.text || "";
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return { ok: false, error: "no_json", exercises: fallback };

    let parsed;
    try { parsed = JSON.parse(jsonMatch[0]); } catch { return { ok: false, error: "json_parse", exercises: fallback }; }

    const rawEx    = Array.isArray(parsed?.exercises) ? parsed.exercises : [];
    const exercises = rawEx.slice(0, 20).map((e, i) => ({
      index: Number(e.index) || i + 1,
      title: String(e.title || `Ejercicio ${i + 1}`).trim().slice(0, 60),
    }));

    return {
      ok:       true,
      exercises: exercises.length > 0 ? exercises : fallback,
      usage:    response.usage ?? null,
    };
  } catch (err) {
    console.error("[guide.detectExercises]", err?.message);
    return { ok: false, error: err?.message, exercises: fallback };
  }
}

// ── Phase 2: Generar mapa de pasos ───────────────────────────────────────────
// Reutiliza el mismo prefijo de documento cacheado por Phase 1.
// exerciseIndex/exerciseTitle focalizan al Guía en un ejercicio concreto.

function buildStepSystemPrompt(exerciseIndex = null, exerciseTitle = "") {
  const focus = exerciseIndex
    ? `\n\nIMPORTANTE: El alumno trabaja el Ejercicio ${exerciseIndex}${exerciseTitle ? ` — "${exerciseTitle}"` : ""}. Genera los pasos ÚNICAMENTE para ese ejercicio. Ignora el resto del documento.`
    : "";

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
}${focus}`;
}

export async function generateStepMap({
  taskTitle       = "",
  taskDescription = "",
  attachments     = [],
  exerciseIndex   = null,
  exerciseTitle   = "",
  mode            = "",
  apiKey          = "",
}) {
  if (!apiKey) return { ok: false, error: "missing_api_key" };

  const client    = new Anthropic({ apiKey });
  // Mismo bloque de documento con mismo cache_control → cache hit desde Phase 1
  const docBlocks = await buildDocumentBlocks(attachments);

  const userContent = [
    ...docBlocks,
    {
      type: "text",
      text: [
        taskTitle       ? `Tarea: ${taskTitle}`                          : null,
        taskDescription ? `Descripción: ${taskDescription.slice(0, 400)}` : null,
        mode            ? `Modo: ${String(mode).toUpperCase()}`           : null,
        exerciseIndex   ? `Ejercicio seleccionado: Ejercicio ${exerciseIndex}${exerciseTitle ? ` — ${exerciseTitle}` : ""}` : null,
      ].filter(Boolean).join("\n"),
    },
  ];

  try {
    const response = await client.messages.create({
      model:     GUIDE_MODEL,
      system:    buildStepSystemPrompt(exerciseIndex, exerciseTitle),
      messages:  [{ role: "user", content: userContent }],
      max_tokens: 600,
    });

    const raw       = response.content.find((b) => b.type === "text")?.text || "";
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return { ok: false, error: "no_json_in_response", raw };

    let parsed;
    try { parsed = JSON.parse(jsonMatch[0]); } catch { return { ok: false, error: "json_parse_failed", raw }; }

    const rawSteps = Array.isArray(parsed?.steps) ? parsed.steps : [];
    if (rawSteps.length < MIN_STEPS) return { ok: false, error: "too_few_steps", count: rawSteps.length };

    const steps = rawSteps.slice(0, MAX_STEPS).map((s, i) => ({
      index:     i,
      title:     String(s?.title || `Paso ${i + 1}`).trim().slice(0, 120),
      completed: false,
    }));

    return { ok: true, steps, model: GUIDE_MODEL, usage: response.usage ?? null };
  } catch (err) {
    return { ok: false, error: err?.error?.type || err?.code || "guide_failed", message: err?.message };
  }
}
