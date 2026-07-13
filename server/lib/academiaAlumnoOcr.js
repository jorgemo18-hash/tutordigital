import { extraerJsonConVision } from "./anthropicVisionOcr.js";

const EXTRACTION_PROMPT = `Extrae los datos de esta ficha de inscripción de academia. Devuelve SOLO un JSON con estos campos exactos (deja vacío "" si no encuentras el dato con seguridad):
{
  "nombre": "",
  "curso": "",
  "email": "",
  "telefono": "",
  "dni": "",
  "direccion": "",
  "ciudad": "",
  "codigo_postal": "",
  "metodo_pago": "",
  "notas": ""
}

Para metodo_pago usa solo estos valores: "bizum", "transferencia", "efectivo", "sepa". Devuelve solo el JSON, sin explicaciones.`;

// Extrae los campos de una ficha de inscripción en papel — mismo patrón que
// la extracción de gastos (academiaFinanzas/gastoExtraccion.js), con su
// propio prompt. La llamada a Claude + parseo de JSON vive en
// anthropicVisionOcr.js, compartida por ambas.
export async function extraerDatosInscripcion(client, { base64, mediaType }) {
  return extraerJsonConVision(client, { base64, mediaType, prompt: EXTRACTION_PROMPT });
}
