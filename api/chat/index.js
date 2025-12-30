export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method Not Allowed" });

  try {
    if (!process.env.OPENAI_API_KEY) {
      return res.status(500).json({ error: "Falta OPENAI_API_KEY en Vercel" });
    }

    const { messages } = req.body;

    if (!Array.isArray(messages)) {
      return res.status(400).json({ error: "Body inválido: falta messages[]" });
    }

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content: "Eres un tutor académico. No das la solución. Guías al alumno con preguntas.",
          },
          ...messages,
        ],
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      // devuelve el error real para que lo veas
      return res.status(response.status).json({ error: data });
    }

    const text = data?.choices?.[0]?.message?.content ?? "No he podido responder ahora mismo.";
    return res.status(200).json({ text });
  } catch (e) {
    return res.status(500).json({ error: "Error conectando con el tutor" });
  }
}
