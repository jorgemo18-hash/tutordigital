import { z } from "zod";
import { ALLOWED_NORMAS_MIMES } from "./normas.js";
import { subirNormasConConversion } from "./subirNormasConConversion.js";

// Mismo shape que usan el resto de endpoints de subida en base64 de este
// repo (OCR de gastos en gastosFoto.routes.js, OCR de la ficha de
// inscripción en inscripcionTexto.routes.js): { base64, mime } tal cual lo
// arma el frontend (ver apiDocumentos.js/fileUtils.js — base64 puro, sin
// el prefijo data:...;base64,).
export const UploadBodySchema = z.object({
  base64: z.string().min(1),
  mime: z.enum([...ALLOWED_NORMAS_MIMES]),
});

// Valida el body crudo de POST /normas y orquesta la subida — único punto
// que traduce el body HTTP ({base64, mime}) al shape interno que espera
// subirNormasConConversion ({base64Input, mime}), con el renombrado
// EXPLÍCITO (nunca un spread de `parsed.data`) que ya usan gastosFoto.routes.js
// e inscripcionTexto.routes.js. Vive aparte de la ruta para poder testear
// la validación + el mapeo de campos con un archivo real sin montar
// Fastify — un spread sin renombrar (`{ ...parsed.data, pdfServiceUrl }`)
// fue exactamente la regresión del commit 6425cc7: base64Input llegaba
// undefined a subirNormasConConversion y toda subida (PDF o DOCX) fallaba
// con invalid_base64, aunque el archivo y el body HTTP fueran perfectos
// (ver academiaNormasSubida.test.mjs, que reproduce el bug con un DOCX
// real antes del fix).
export async function manejarSubidaNormas(
  body,
  { admin, tenantId, pdfServiceUrl },
  { subirNormasConConversionFn = subirNormasConConversion } = {}
) {
  const parsed = UploadBodySchema.safeParse(body || {});
  if (!parsed.success) {
    return { ok: false, code: "invalid_body", motivo: "Invalid body", issues: parsed.error.issues };
  }

  return subirNormasConConversionFn(admin, tenantId, {
    base64Input: parsed.data.base64,
    mime: parsed.data.mime,
    pdfServiceUrl,
  });
}
