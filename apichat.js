import OpenAI from "openai";

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { messages } = req.body || {};
    if (!Array.isArray(messages)) {
      return res.status(400).json({ error: "Missing messages[]" });
    }

    // Instrucciones “tutor” (tu base). Luego las afinamos.
    const instructions =
      "Eres un tutor virtual para alumnos. No des la respuesta directa; guía con preguntas y pasos. Sé claro, breve y práctico. Si el alumno pide la solución, ayúdale a pensar.";

    // Responses API (recomendado)
    const response = await client.responses.create({
      model: "gpt-5",
      reasoning: { effort: "low" },
      instructions,
      input: messages.map((m) => ({
        role: m.role,
        content: [{ type: "input_text", text: m.content }],
      })),
    });

    return res.status(200).json({ text: response.output_text });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Server error" });
  }
}
