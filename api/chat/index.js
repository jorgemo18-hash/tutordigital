// api/chat/index.js

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { messages = [], image } = req.body || {};

    // Normaliza historial
    const msgs = (Array.isArray(messages) ? messages : []).map((m) => ({
      role: m?.role === "assistant" ? "assistant" : "user",
      content: typeof m?.content === "string" ? m.content : String(m?.content || ""),
    }));

    // Si hay imagen, “convierte” el ÚLTIMO mensaje del usuario a multimodal (texto + imagen)
    if (image) {
      const i = (() => {
        for (let k = msgs.length - 1; k >= 0; k--) if (msgs[k].role === "user") return k;
        return -1;
      })();

      const text = i >= 0 ? msgs[i].content : "Analiza la imagen adjunta y ayúdame con ello.";

      if (i >= 0) {
        msgs[i] = {
          role: "user",
          content: [
            { type: "text", text },
            { type: "image_url", image_url: { url: image } },
          ],
        };
      } else {
        msgs.push({
          role: "user",
          content: [
            { type: "text", text },
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
        "Authorization": `Bearer ${apiKey}`,
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
      // Devuelve el error tal cual (te ayudará a ver si es "model no vision", "payload too large", etc.)
      return res.status(r.status).json({ error: data?.error?.message || "OpenAI error" });
    }

    const text =
      data?.choices?.[0]?.message?.content ||
      "No he podido responder ahora mismo.";

    return res.status(200).json({ text });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: e?.message || "Server error" });
  }
}