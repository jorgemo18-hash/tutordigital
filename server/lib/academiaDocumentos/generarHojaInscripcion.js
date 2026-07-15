import { fetchConfigHojaInscripcion } from "./consultas.js";
import { buildHojaInscripcionPayload } from "./payload.js";
import { Sentry } from "../sentry.js";

// El microservicio corre en el plan gratuito de Render con LibreOffice
// instalado — un cold start puede tardar varios minutos (confirmado en
// producción: hasta 3.5 min seguidos de 502 del proxy de Render, ver
// informe de diagnóstico previo). Un único reintento a los 5s (el patrón
// original de enviarInforme.js) no basta para ese caso — se mantiene el
// mismo mecanismo (intento → espera fija → reintento) pero con más
// vueltas: hasta REINTENTOS_MAX intentos en total, separados por
// REINTENTO_ESPERA_MS cada uno (~40s de espera acumulada en el peor caso).
const REINTENTOS_MAX = 5;
const REINTENTO_ESPERA_MS = 10000;

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
  for (let intento = 1; !resultado.ok && intento < REINTENTOS_MAX; intento++) {
    await new Promise((resolve) => setTimeout(resolve, REINTENTO_ESPERA_MS));
    resultado = await llamarPdfServiceHoja(pdfServiceUrl, payload);
  }
  if (!resultado.ok) {
    // Mensaje distinto al genérico "El servicio de PDF devolvió un error."
    // que usa enviarInforme.js — con el mismo texto, Sentry agrupaba estos
    // fallos y los de /enviar-informe en un único issue (confirmado en el
    // informe de diagnóstico: TUTORDIGITAL-BACKEND-3 mezclaba ambos).
    Sentry.captureException(new Error(`Error al generar la hoja de inscripción: ${resultado.motivo || "pdf_service_failed"}`), {
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
