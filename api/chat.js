// api/chat.js
import OpenAI from "openai";

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  try {
    const { messages = [], text = "", image = null, mode = "" } = req.body || {};

    const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

    // Montamos el mensaje final que usas en el frontend
    const content = [];
    if (text) content.push({ type: "text", text: text });
    if (image) content.push({ type: "image_url", image_url: { url: image } });

    const sys =
      "Eres un tutor académico. No des solo la respuesta final: guía paso a paso, pregunta lo necesario y explica claro.";

    const inputMessages = [
      { role: "system", content: sys + (mode ? `\nModo: ${mode}` : "") },
      ...messages.map(m => ({ role: m.role, content: m.content })),
      { role: "user", content: content.length ? content : [{ type: "text", text: text || "" }] },
    ];

    const completion = await client.chat.completions.create({
      model: "gpt-4o-mini",
      messages: inputMessages,
      temperature: 0.4,
    });

    const out = completion.choices?.[0]?.message?.content || "No he podido responder ahora mismo.";
    return res.status(200).json({ text: out });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "API error" });
  }
}