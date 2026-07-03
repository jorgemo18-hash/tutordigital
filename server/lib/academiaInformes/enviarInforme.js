import { fetchAlumnoConFamilia, fetchConfigInforme, fetchReciboLineaAlumno } from "./consultas.js";
import { generarYGuardarComentario } from "./generarInforme.js";
import { buildAcademiaPayload, buildReciboPayload } from "./payload.js";

// Genera (si falta) y envía el informe mensual de un alumno — adjunta
// también el recibo del mes si existe uno para su familia. Único punto de
// entrada usado por la ruta POST /academia/enviar-informe.
export async function enviarInformePorAlumno(admin, { tenantId, tenantNombre, alumnoId, mes, anio, apiKey, pdfServiceUrl }) {
  const { alumno, error: alumnoErr } = await fetchAlumnoConFamilia(admin, tenantId, alumnoId);
  if (alumnoErr) return { ok: false, code: "fetch_failed", motivo: "No se pudo leer el alumno." };
  if (!alumno) return { ok: false, code: "not_found", motivo: "Alumno no encontrado." };
  if (!alumno.familia?.email) {
    return { ok: false, code: "sin_email", motivo: "La familia no tiene email configurado." };
  }

  const generado = await generarYGuardarComentario(admin, { tenantId, alumnoId, mes, anio, apiKey });
  if (!generado.ok) return generado;

  const { linea, numeroRecibo, error: reciboErr } = await fetchReciboLineaAlumno(admin, tenantId, {
    alumnoId, familiaId: alumno.familia_id, mes, anio,
  });
  if (reciboErr) return { ok: false, code: "fetch_failed", motivo: "No se pudo leer el recibo." };

  const config = await fetchConfigInforme(admin, tenantId);
  const payload = {
    emailDestino: alumno.familia.email,
    alumno: { nombre: alumno.nombre, curso: alumno.curso || "" },
    mes,
    anio,
    diasMes: generado.dias,
    comentario: generado.comentario,
    recibo: buildReciboPayload(linea, numeroRecibo, alumno.familia),
    academia: buildAcademiaPayload(config, tenantNombre),
  };

  let resp;
  try {
    resp = await fetch(`${pdfServiceUrl}/informe`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
  } catch {
    return { ok: false, code: "pdf_service_unreachable", motivo: "No se pudo contactar con el servicio de generación de PDF." };
  }
  if (!resp.ok) {
    const body = await resp.json().catch(() => ({}));
    return { ok: false, code: "pdf_service_failed", motivo: body.error || "El servicio de PDF devolvió un error." };
  }

  const { error: enviadoErr } = await admin
    .from("academia_informes")
    .update({ enviado_at: new Date().toISOString() })
    .eq("id", generado.informeId);
  if (enviadoErr) {
    return { ok: false, code: "fetch_failed", motivo: "El informe se envió pero no se pudo marcar como enviado." };
  }
  return { ok: true };
}
