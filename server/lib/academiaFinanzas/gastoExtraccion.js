import { extraerJsonConVision } from "../anthropicVisionOcr.js";

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

// Extrae los campos de una factura/ticket de gasto — mismo patrón que la
// extracción de fichas de inscripción (../academiaAlumnoOcr.js), con su
// propio prompt y categorías. La llamada a Claude + parseo de JSON vive en
// anthropicVisionOcr.js, compartida por ambas.
export async function extraerDatosGasto(client, { base64, mediaType }) {
  return extraerJsonConVision(client, { base64, mediaType, prompt: EXTRACTION_PROMPT });
}
