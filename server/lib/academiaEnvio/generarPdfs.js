import { Sentry } from "../sentry.js";
import { fetchPdfBuffer } from "./pdfServiceClient.js";

// Mensajes de Sentry distintos a propósito (recibo vs informe) — un
// mensaje genérico compartido agrupaba en un mismo issue fallos que en
// realidad eran de PDFs distintos (TUTORDIGITAL-BACKEND-3).
const PDF_SERVICE_BODY_MAX = 500;

function capturarFalloPdf(operation, resultado, extra, captureExceptionFn) {
  captureExceptionFn(new Error(`${operation}: ${resultado.motivo || "pdf_service_failed"}`), {
    extra: {
      operation, ...extra,
      code: resultado.code,
      pdfServiceStatus: resultado.pdfServiceStatus,
      // Un 502 de la plataforma (Render) devuelve su página de error HTML
      // completa, con fuentes embebidas en base64 — sin truncar, un solo
      // evento puede pesar varios MB y hacer el issue ilegible en Sentry
      // (visto en TUTORDIGITAL-BACKEND-B). El código/estado HTTP de arriba
      // ya identifica el tipo de fallo; esto es solo para inspección manual.
      pdfServiceBody: resultado.pdfServiceBody?.slice(0, PDF_SERVICE_BODY_MAX),
    },
  });
}

export async function generarReciboPdf({
  tenantId, familiaId, payload, pdfServiceUrl,
  fetchPdfBufferFn = fetchPdfBuffer,
  captureExceptionFn = Sentry.captureException,
}) {
  const resultado = await fetchPdfBufferFn(pdfServiceUrl, "/recibo", payload);
  if (!resultado.ok) capturarFalloPdf("generar_recibo_pdf", resultado, { tenantId, familiaId }, captureExceptionFn);
  return resultado;
}

export async function generarInformePdf({
  tenantId, alumnoId, payload, pdfServiceUrl,
  fetchPdfBufferFn = fetchPdfBuffer,
  captureExceptionFn = Sentry.captureException,
}) {
  const resultado = await fetchPdfBufferFn(pdfServiceUrl, "/informe", payload);
  if (!resultado.ok) capturarFalloPdf("generar_informe_pdf", resultado, { tenantId, alumnoId }, captureExceptionFn);
  return resultado;
}
