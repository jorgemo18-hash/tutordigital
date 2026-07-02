import Anthropic from "@anthropic-ai/sdk";

// Lista fija que se le sugiere a Claude en el prompt — las categorías del
// selector del drawer son dinámicas por tenant desde
// academia.gastos.categorias.routes.js, así que ya no comparten una única
// fuente de verdad con esta lista. Si Claude sugiere una categoría que el
// tenant no tiene, el frontend la ignora en silencio (ver
// gastoCategoriaSelect.js, setValorSiExiste).
export const CATEGORIAS_OCR = ["Material", "Suministros", "Alquiler", "Servicios", "Personal", "Otros"];

const EXTRACTION_PROMPT = `Extrae los datos de esta factura o ticket de gasto. Devuelve SOLO un JSON con estos campos exactos (usa null si no puedes extraer un campo con seguridad):
{
  "fecha": null,
  "proveedor": null,
  "cif": null,
  "concepto": null,
  "categoria": null,
  "base_imponible": null,
  "iva_pct": null,
  "importe_iva": null,
  "retencion_pct": null,
  "importe_retencion": null,
  "total_a_pagar": null
}

"fecha" en formato YYYY-MM-DD. "categoria" debe ser exactamente una de: ${CATEGORIAS_OCR.map((c) => `"${c}"`).join(", ")}. Los campos numéricos (base_imponible, iva_pct, importe_iva, retencion_pct, importe_retencion, total_a_pagar) van sin símbolo de moneda, solo el número. Devuelve solo el JSON, sin explicaciones.`;

// PDF necesita un content block "document" en vez de "image" — el resto
// del mensaje es idéntico.
function buildContentBlock(base64, mediaType) {
  const type = mediaType === "application/pdf" ? "document" : "image";
  return { type, source: { type: "base64", media_type: mediaType, data: base64 } };
}

// Llama a Claude con visión para extraer los campos de una factura/ticket
// de gasto — mismo patrón que la extracción de fichas de inscripción
// (academia.inscripciones.routes.js), con su propio prompt y categorías.
export async function extraerDatosGasto(apiKey, { base64, mediaType }) {
  const client = new Anthropic({ apiKey });
  const response = await client.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 1000,
    messages: [
      {
        role: "user",
        content: [buildContentBlock(base64, mediaType), { type: "text", text: EXTRACTION_PROMPT }],
      },
    ],
  });

  const text = response.content.find((b) => b.type === "text")?.text || "";
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) return { error: "no_json" };

  try {
    return { datos: JSON.parse(match[0]) };
  } catch {
    return { error: "invalid_json" };
  }
}
