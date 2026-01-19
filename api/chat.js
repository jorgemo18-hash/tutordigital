// api/chat.js
import OpenAI from "openai";
import { toFile } from "openai/uploads";

function getBase64FromDataUrl(dataUrl = "") {
  const s = String(dataUrl);
  const i = s.indexOf("base64,");
  if (i === -1) return null;
  return s.slice(i + "base64,".length).replace(/\s/g, ""); // quita saltos/espacios
}

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  try {
    const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

    const body = req.body || {};
    const text = String(body.text || "").trim();
    const mode = String(body.mode || "").trim();

    const image = body.image || null; // data URL imagen

    // Acepta ambas formas: body.file {...} o body.fileDataUrl + nombre/mime
    const file =
      body.file ||
      (body.fileDataUrl
        ? { dataUrl: body.fileDataUrl, name: body.fileName, mime: body.fileMime }
        : null);

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

    // PDF -> subir a OpenAI y referenciar por file_id
    if (file && typeof file === "object" && file.dataUrl) {
      const base64 = getBase64FromDataUrl(file.dataUrl);
      if (!base64) {
        return res.status(400).json({ error: "PDF dataUrl inválido (no contiene base64,)" });
      }

      const filename = String(file.name || "archivo.pdf");
      const mime = String(file.mime || "application/pdf");
      const buf = Buffer.from(base64, "base64");

      const uploaded = await client.files.create({
        file: await toFile(buf, filename, { type: mime }),
        purpose: "assistants",
      });

      content.push({
        type: "input_file",
        file_id: uploaded.id,
      });
    }

    // Imagen
    if (image) {
      content.push({ type: "input_image", image_url: String(image) });
    }

    const userText = [mode ? `[Modo: ${mode}]` : "", text].filter(Boolean).join("\n\n").trim();
    if (userText) content.push({ type: "input_text", text: userText });

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

    return res.status(200).json({ text: String(response.output_text || "") });
  } catch (err) {
    console.error("API error:", err?.message);
    console.error("API error status:", err?.status);
    try { console.error("API error raw:", JSON.stringify(err, null, 2)); } catch {}
    return res.status(500).json({ error: err?.message || "API error", status: err?.status || null });
  }
}