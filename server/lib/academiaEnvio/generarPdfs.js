import { Sentry } from "../sentry.js";
import { fetchPdfBuffer } from "./pdfServiceClient.js";

// Mensajes de Sentry distintos a propósito (recibo vs informe) — un
// mensaje genérico compartido agrupaba en un mismo issue fallos que en
// realidad eran de PDFs distintos (TUTORDIGITAL-BACKEND-3).
function capturarFalloPdf(operation, resultado, extra) {
  Sentry.captureException(new Error(`${operation}: ${resultado.motivo || "pdf_service_failed"}`), {
    extra: {
      operation, ...extra,
      code: resultado.code,
      pdfServiceStatus: resultado.pdfServiceStatus,
      pdfServiceBody: resultado.pdfServiceBody,
    },
  });
}

export async function generarReciboPdf({ tenantId, familiaId, payload, pdfServiceUrl }) {
  const resultado = await fetchPdfBuffer(pdfServiceUrl, "/recibo", payload);
  if (!resultado.ok) capturarFalloPdf("generar_recibo_pdf", resultado, { tenantId, familiaId });
  return resultado;
}

export async function generarInformePdf({ tenantId, alumnoId, payload, pdfServiceUrl }) {
  const resultado = await fetchPdfBuffer(pdfServiceUrl, "/informe", payload);
  if (!resultado.ok) capturarFalloPdf("generar_informe_pdf", resultado, { tenantId, alumnoId });
  return resultado;
}
