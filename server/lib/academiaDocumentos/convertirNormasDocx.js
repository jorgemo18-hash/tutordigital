const REINTENTO_ESPERA_MS = 5000;

// Un intento de conversión — mismo patrón que llamarPdfService en
// academiaInformes/enviarInforme.js (mismo servicio, mismo manejo de "no
// es JSON" en un cold start de Render): pdfServiceUrl/base64Docx
// explícitos en vez de cerrar sobre el scope del llamador, para poder
// invocarla dos veces sin duplicar la construcción del body.
async function llamarConvertirDocx(pdfServiceUrl, base64Docx) {
  let resp;
  try {
    resp = await fetch(`${pdfServiceUrl}/convertir-docx`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ docx_base64: base64Docx }),
    });
  } catch {
    return { ok: false, code: "pdf_service_unreachable", motivo: "No se pudo contactar con el servicio de conversión de documentos." };
  }
  if (!resp.ok) {
    const pdfServiceBody = await resp.text().catch(() => "");
    let parsed = {};
    try { parsed = JSON.parse(pdfServiceBody); } catch {}
    return {
      ok: false,
      code: "pdf_service_failed",
      motivo: parsed.error || "El servicio de conversión devolvió un error.",
      pdfServiceStatus: resp.status,
      pdfServiceBody,
    };
  }
  const buffer = Buffer.from(await resp.arrayBuffer());
  return { ok: true, buffer };
}

// Convierte un DOCX a PDF vía el microservicio (ver /convertir-docx en
// tutordigital-pdf-service) — único punto de entrada usado al subir el
// documento de normas (ver normas.routes.js), con un reintento a los 5s
// si el primer intento falla, igual que el resto de llamadas a este
// microservicio (el cold start del plan gratuito de Render puede tumbar
// el primer intento).
export async function convertirNormasDocxAPdf(pdfServiceUrl, base64Docx) {
  let resultado = await llamarConvertirDocx(pdfServiceUrl, base64Docx);
  if (!resultado.ok) {
    await new Promise((resolve) => setTimeout(resolve, REINTENTO_ESPERA_MS));
    resultado = await llamarConvertirDocx(pdfServiceUrl, base64Docx);
  }
  return resultado;
}
