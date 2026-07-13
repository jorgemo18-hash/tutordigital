import { fetchConfigHojaInscripcion } from "./consultas.js";
import { buildHojaInscripcionPayload } from "./payload.js";
import { Sentry } from "../sentry.js";

const REINTENTO_ESPERA_MS = 5000;

// Un intento de llamada al microservicio de PDF — mismo patrón que
// llamarPdfService en academiaInformes/enviarInforme.js (mismo servicio,
// mismo manejo de "no es JSON" en un cold start de Render), pero este
// endpoint devuelve el PDF directamente en el body en vez de mandarlo por
// email, así que en éxito se lee como buffer en vez de solo {ok:true}.
async function llamarPdfServiceHoja(pdfServiceUrl, payload) {
  let resp;
  try {
    resp = await fetch(`${pdfServiceUrl}/hoja-inscripcion`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
  } catch {
    return { ok: false, code: "pdf_service_unreachable", motivo: "No se pudo contactar con el servicio de generación de PDF." };
  }
  if (!resp.ok) {
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
  const buffer = Buffer.from(await resp.arrayBuffer());
  return { ok: true, buffer };
}

// Genera la hoja de inscripción en blanco del tenant — único punto de
// entrada usado por GET /academia/documentos/hoja-inscripcion.
export async function generarHojaInscripcion(admin, { tenantId, tenantNombre, pdfServiceUrl }) {
  const config = await fetchConfigHojaInscripcion(admin, tenantId);
  const payload = { academia: buildHojaInscripcionPayload(config, tenantNombre) };

  let resultado = await llamarPdfServiceHoja(pdfServiceUrl, payload);
  if (!resultado.ok) {
    await new Promise((resolve) => setTimeout(resolve, REINTENTO_ESPERA_MS));
    resultado = await llamarPdfServiceHoja(pdfServiceUrl, payload);
  }
  if (!resultado.ok) {
    Sentry.captureException(new Error(resultado.motivo || "pdf_service_failed"), {
      extra: {
        operation: "generar_hoja_inscripcion_pdf",
        tenantId,
        code: resultado.code,
        pdfServiceStatus: resultado.pdfServiceStatus,
        pdfServiceBody: resultado.pdfServiceBody,
      },
    });
  }
  return resultado;
}
