import { subirNormas, NORMAS_DOCX_MIME, NORMAS_PDF_MIME } from "./normas.js";
import { convertirNormasDocxAPdf } from "./convertirNormasDocx.js";
import { getBase64FromMaybeDataUrl } from "../chatValidation.js";

// Orquesta la subida de normas: si el mime es DOCX, lo convierte a PDF vía
// el microservicio antes de guardar — a partir de este cambio el bucket
// nunca almacena un DOCX recién subido, solo PDF (ver normas.routes.js);
// si el mime ya es PDF, se guarda tal cual, sin llamar al conversor.
// convertirDocxFn/subirNormasFn llegan como dependencias explícitas (no
// import directo dentro del cuerpo) para poder sustituirlas en tests sin
// mockear fetch ni Storage — ver academiaNormasConversion.test.mjs.
export async function subirNormasConConversion(
  admin,
  tenantId,
  { base64Input, mime, pdfServiceUrl },
  { convertirDocxFn = convertirNormasDocxAPdf, subirNormasFn = subirNormas } = {}
) {
  if (mime !== NORMAS_DOCX_MIME) {
    return subirNormasFn(admin, tenantId, { base64Input, mime });
  }

  const base64Docx = getBase64FromMaybeDataUrl(base64Input);
  if (!base64Docx) return { ok: false, code: "invalid_base64", motivo: "Archivo inválido." };

  const conversion = await convertirDocxFn(pdfServiceUrl, base64Docx);
  if (!conversion.ok) return conversion;

  return subirNormasFn(admin, tenantId, { base64Input: conversion.buffer.toString("base64"), mime: NORMAS_PDF_MIME });
}
