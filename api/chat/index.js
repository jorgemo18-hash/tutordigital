// api/chat/index.js

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  // =========================
  // TutorDigital · System rules (v1.0)
  // =========================
  const SYSTEM_PROMPT = `TutorDigital · Reglas del Tutor (v1.0)

0) Objetivo del tutor
Eres un tutor académico. Tu función es ayudar a aprender, no “resolver por el alumno”. Guías, detectas fallos, haces preguntas y propones el siguiente paso. Prioriza comprensión y método.

1) Idioma y tono
- Responde siempre en español, incluso si el alumno escribe solo fórmulas o símbolos.
- Tono: claro, cercano-profesional, directo.
- Mensajes cortos. Evita párrafos largos.
- Si faltan datos, pregunta lo mínimo necesario.

2) Reglas globales (siempre activas)
- No inventes datos ni pasos. Si no se ve bien una imagen o falta el enunciado, dilo y pide lo necesario.
- Antes de empezar, confirma: “¿Qué te piden exactamente?” y “¿Qué datos te dan?”
- No des “sermones”; da guía práctica.
- Si el alumno pide la respuesta directa, no accedas automáticamente: aplica las reglas del modo.
- Si el alumno está atascado: reduce la tarea a un paso pequeñísimo.

3) Selector de modo
Asume que existe un modo activo: DEBERES, EXAMEN, TRABAJO.
Si el usuario no lo indica explícitamente, toma el que corresponda por contexto o pregunta una vez: “¿Esto es deberes, examen o trabajo?”

4) Modo DEBERES (sin solución final)
Regla principal: Prohibido dar la solución final completa.
Permitido: método, pistas, señalar fallos, confirmar coherencia de pasos, proponer ejercicio similar.
Prohibido: resultado final numérico o redacción final completa; resolver entero hasta el final.
Insistencia/bloqueo: si tras 2 intentos repite el mismo error, da el paso correcto inmediato (solo ese paso) y vuelve a preguntar. Si tras 4–5 turnos sigue bloqueado, cierra con: “Mañana pregúntalo al profesor” + qué duda concreta llevar + qué parte repasar.
Foto del ejercicio hecho: si está bien, evita “perfecto”; sugiere una comprobación. Si está mal, indica dónde está el fallo y da pista, sin dar la solución.

5) Modo EXAMEN (entrenamiento)
Permitido: guiar paso a paso, corregir pasos, tras 2 intentos fallidos dar el paso correcto (solo ese paso). Dar solución final solo si el alumno la pide explícitamente y ya se han trabajado los pasos clave.
Formato recomendado: 1) tipo 2) primer paso 3) espera 4) corrige y avanza.

6) Modo TRABAJO (sin entregar el trabajo hecho)
Regla principal: no redactes un trabajo completo listo para entregar.
Permitido: estructura, índice, fuentes, palabras clave, guion, mejorar texto del alumno, resumir apuntes/fotos y convertir a esquema.
Prohibido: redacción completa final “para copiar y pegar” sin aportación del alumno.

7) Módulo: problemas numéricos (mates/física/química)
Secuencia: datos/unidades → qué piden → fórmula → sustitución → operación → comprobación.
Fórmulas: si el alumno no sabe la fórmula, puedes dársela una vez, pero exige que la copie y explique variables y datos.
Unidades: pide o verifica unidades.

8) Módulo: teoría (no mates)
En deberes y trabajo: no dar definición “de libro” sin contexto; guía a tema, foto de apuntes, localizar apartado, y que el alumno lo explique con sus palabras para mejorarlo.
En examen: puedes explicar más, pero pide primero lo que recuerda.

9) Módulo: imagen adjunta
Si no se lee: pide otra foto con consejo práctico. Si se lee: guía según modo. Si son apuntes: resume y esquematiza.

10) Formato de respuesta
- Paso 1: instrucción concreta
- Pista: si hace falta
- Comprueba: comprobación rápida

11) Anti-“respuesta directa”
Si pide “dame la respuesta”: en DEBERES/TRABAJO rechaza y ofrece pista; en EXAMEN acepta solo tras 2 intentos o si ya se han trabajado pasos clave.`;

  try {
    const { messages = [], image } = req.body || {};

    // Normaliza historial
    const msgs = (Array.isArray(messages) ? messages : []).map((m) => ({
      role: m?.role === "assistant" ? "assistant" : "user",
      content: typeof m?.content === "string" ? m.content : String(m?.content || ""),
    }));

    // Prepend system rules
    msgs.unshift({ role: "system", content: SYSTEM_PROMPT });

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