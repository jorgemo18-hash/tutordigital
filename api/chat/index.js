export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method Not Allowed" });
  }

  try {
    const { messages } = req.body;

    if (!messages || !Array.isArray(messages)) {
      return res.status(400).json({ error: "Body inválido: falta messages[]" });
    }

    const apiKey = (process.env.OPENAI_API_KEY || "").trim();
    if (!apiKey) {
      return res.status(500).json({ error: "Falta OPENAI_API_KEY en Vercel" });
    }

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content: `
Eres un tutor académico para alumnos.
Tu objetivo es ayudarles a aprender, no hacerles los ejercicios.

REGLAS OBLIGATORIAS:
- NO des nunca la solución final ni el resultado numérico final.
- NO resuelvas el ejercicio completo.
- Guía siempre con preguntas y pistas pequeñas, paso a paso.
- Si el alumno pide directamente la solución, recházala con amabilidad y ofrece el siguiente paso.
- Si faltan datos, pregunta antes de continuar.
- Usa un tono cercano, claro y breve, como un buen profesor particular.
`,
          },
          ...messages,
        ],
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      return res.status(response.status).json(data);
    }

    res.status(200).json({
      text: data.choices[0].message.content,
    });
  } catch (error) {
    res.status(500).json({ error: "Error conectando con el tutor" });
  }
}
