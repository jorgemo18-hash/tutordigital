import Anthropic from "@anthropic-ai/sdk";

const SYSTEM_PROMPT =
  "Eres un tutor de academia de refuerzo. Escribe un comentario mensual para las familias basándote en las sesiones del mes.";

function formatFechaCorta(fechaISO) {
  const [, mes, dia] = fechaISO.split("-");
  return `${dia}/${mes}`;
}

function formatearSesion(sesion) {
  const asignatura = sesion.asignatura || "Clase";
  const tema = sesion.tema ? ` (${sesion.tema})` : "";
  const comentario = sesion.comentario ? ` — Comentario: ${sesion.comentario}` : " — Sin comentario.";
  return `- ${formatFechaCorta(sesion.fecha)}: ${asignatura}${tema}${comentario}`;
}

function formatearNotas(notas) {
  if (!notas.length) return "";
  const lista = notas.map((n) => `${n.asignatura}: ${n.nota} (${formatFechaCorta(n.fecha)})`).join(", ");
  return `\n\nNotas de examen: ${lista}`;
}

function buildUserPrompt({ nombre, curso, sesiones, notas }) {
  const lista = sesiones.length ? sesiones.map(formatearSesion).join("\n") : "Sin sesiones registradas este mes.";
  return `Alumno: ${nombre}, Curso: ${curso || ""}
Sesiones del mes:
${lista}${formatearNotas(notas)}

Instrucciones:
- Lenguaje neutro en género (evitar "el alumno"/"la alumna", usar "ha trabajado", "se ha notado")
- Tono cercano, como hablar con los padres en persona
- 3-4 frases, menciona temas trabajados y evolución
- Si hay notas de examen, menciónalas con naturalidad
- Sin saludos ni despedidas
- Solo el párrafo en español`;
}

// Genera el comentario mensual para el informe de un alumno — solo se llama
// cuando academia_informes no tiene ya un comentario guardado para ese
// alumno/mes/año (ver enviarInforme.js).
export async function generarComentarioInforme(apiKey, { nombre, curso, sesiones, notas }) {
  const client = new Anthropic({ apiKey });
  const response = await client.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 400,
    system: SYSTEM_PROMPT,
    messages: [{ role: "user", content: buildUserPrompt({ nombre, curso, sesiones, notas }) }],
  });
  const texto = response.content.find((b) => b.type === "text")?.text || "";
  return texto.trim();
}
