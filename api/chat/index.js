
// api/chat/index.js
import { buildSystemPrompt } from "./prompt.js";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { messages = [], text = "", image } = req.body || {};

    // 1) Normaliza historial (lo que viene del cliente)
    const msgs = (Array.isArray(messages) ? messages : []).map((m) => ({
      role: m?.role === "assistant" ? "assistant" : "user",
      content:
        typeof m?.content === "string" ? m.content : String(m?.content || ""),
    }));

    // 2) Asegura que el input actual (req.body.text) esté al final como último mensaje del usuario
    const inputText =
      typeof text === "string" ? text.trim() : String(text || "").trim();

    if (inputText) {
      const last = msgs[msgs.length - 1];
      const alreadyLast =
        last &&
        last.role === "user" &&
        typeof last.content === "string" &&
        last.content.trim() === inputText;

      if (!alreadyLast) {
        msgs.push({ role: "user", content: inputText });
      }
    }

    // 3) System prompt centralizado
    const SYSTEM_PROMPT = buildSystemPrompt();
    msgs.unshift({ role: "system", content: SYSTEM_PROMPT });

    // 4) Si hay imagen, convierte el ÚLTIMO mensaje del usuario a multimodal (texto + imagen)
    if (image) {
      let i = -1;
      for (let k = msgs.length - 1; k >= 0; k--) {
        if (msgs[k].role === "user") {
          i = k;
          break;
        }
      }

      const baseText =
        i >= 0 && typeof msgs[i].content === "string"
          ? msgs[i].content
          : inputText || "Analiza la imagen adjunta y ayúdame con ello.";

      if (i >= 0) {
        msgs[i] = {
          role: "user",
          content: [
            { type: "text", text: baseText },
            { type: "image_url", image_url: { url: image } },
          ],
        };
      } else {
        msgs.push({
          role: "user",
          content: [
            { type: "text", text: baseText },
            { type: "image_url", image_url: { url: image } },
          ],
        });
      }
    }

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return res.status(500).json({ error: "Missing OPENAI_API_KEY" });
    }

    const model = process.env.OPENAI_MODEL || "gpt-4o-mini";

    const r = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        messages: msgs,
        temperature: 0.3,
        max_tokens: 800,
      }),
    });

    const data = await r.json().catch(() => ({}));

    if (!r.ok) {
      return res
        .status(r.status)
        .json({ error: data?.error?.message || "OpenAI error" });
    }

    const out =
      data?.choices?.[0]?.message?.content ||
      "No he podido responder ahora mismo.";

    return res.status(200).json({ text: out });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: e?.message || "Server error" });
  }
}