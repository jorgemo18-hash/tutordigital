// Cliente genérico para los endpoints de tutordigital-pdf-service que
// devuelven el PDF en bytes (patrón ya usado por
// academiaDocumentos/generarHojaInscripcion.js: intento → si falla,
// espera fija → reintento, hasta agotar `reintentosMax`). Sin acoplar
// Sentry aquí a propósito — cada llamador (generarPdfs.js) captura su
// propio evento con un mensaje distinguible, porque un mensaje genérico
// compartido agrupaba en Sentry fallos que en realidad eran de PDFs
// distintos (lección ya aprendida en este repo, ver comentario de
// generarHojaInscripcion.js).
async function intentarUnaVez(pdfServiceUrl, path, payload) {
  let resp;
  try {
    resp = await fetch(`${pdfServiceUrl}${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
  } catch {
    return { ok: false, code: "pdf_service_unreachable", motivo: "No se pudo contactar con el servicio de generación de PDF." };
  }
  if (!resp.ok) {
    // Texto crudo primero — un 502 del proxy de Render en cold start no es
    // JSON, y con solo .json().catch(()=>({})) esa respuesta se perdía
    // entera.
    const pdfServiceBody = await resp.text().catch(() => "");
    let parsed = {};
    try { parsed = JSON.parse(pdfServiceBody); } catch {}
    return {
      ok: false,
      code: "pdf_service_failed",
      motivo: parsed.error || "El servicio de PDF devolvió un error.",
      pdfServiceStatus: resp.status,
      pdfServiceBody,
    };
  }
  return { ok: true, buffer: Buffer.from(await resp.arrayBuffer()) };
}

export async function fetchPdfBuffer(pdfServiceUrl, path, payload, { reintentosMax = 5, esperaMs = 10000 } = {}) {
  let resultado = await intentarUnaVez(pdfServiceUrl, path, payload);
  for (let intento = 1; !resultado.ok && intento < reintentosMax; intento++) {
    await new Promise((resolve) => setTimeout(resolve, esperaMs));
    resultado = await intentarUnaVez(pdfServiceUrl, path, payload);
  }
  return resultado;
}
