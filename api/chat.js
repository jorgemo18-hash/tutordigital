// api/chat.js
import OpenAI from "openai";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  try {
    const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

    const body = req.body || {};
    const text = String(body.text || "").trim();
    const mode = String(body.mode || "").trim();

    const image = body.image || null; // data URL (image)
    const file = body.file || null;   // { dataUrl, name, mime }

    const messages = Array.isArray(body.messages) ? body.messages : [];

    const model = process.env.OPENAI_MODEL || "gpt-4o-mini";

    // Historial compacto
    let historyText = "";
    if (messages.length) {
      historyText = messages
        .filter((m) => m && m.role && typeof m.content === "string")
        .map((m) => `${String(m.role).toUpperCase()}: ${m.content}`)
        .join("\n");
    }

    const content = [];

    // PDF
    if (file && typeof file === "object" && file.dataUrl) {
      content.push({
        type: "input_file",
        filename: String(file.name || "archivo.pdf"),
        file_data: String(file.dataUrl), // data:application/pdf;base64,...
      });
    }

    // Imagen
    if (image) {
      content.push({
        type: "input_image",
        image_url: String(image),
      });
    }

    const userText = [mode ? `[Modo: ${mode}]` : "", text].filter(Boolean).join("\n\n").trim();
    if (userText) {
      content.push({ type: "input_text", text: userText });
    }

    if (!userText && (image || (file && file.dataUrl))) {
      content.push({
        type: "input_text",
        text: "Analiza el adjunto y ayúdame. Resume lo importante y contesta la pregunta si la hay.",
      });
    }

    const input = [];
    if (historyText) {
      input.push({
        role: "user",
        content: [{ type: "input_text", text: `Contexto previo (chat):\n${historyText}` }],
      });
    }
    input.push({ role: "user", content });

    const response = await client.responses.create({ model, input });

    res.status(200).json({ text: String(response.output_text || "") });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "API error" });
  }
}