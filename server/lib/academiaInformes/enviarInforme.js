import {
  fetchAlumnoConFamilia,
  fetchConfigInforme,
  fetchNotasExamenMes,
  fetchInformeExistente,
  fetchReciboLineaAlumno,
} from "./consultas.js";
import { fetchDiasMesYSesiones } from "./diasMes.js";
import { generarComentarioInforme } from "./generarComentario.js";
import { buildAcademiaPayload, buildReciboPayload } from "./payload.js";

// Genera (si falta), guarda y envía el informe mensual de un alumno —
// adjunta también el recibo del mes si existe uno para su familia. Único
// punto de entrada usado por la ruta POST /academia/enviar-informe.
export async function enviarInformePorAlumno(admin, { tenantId, tenantNombre, alumnoId, mes, anio, apiKey, pdfServiceUrl }) {
  const { alumno, error: alumnoErr } = await fetchAlumnoConFamilia(admin, tenantId, alumnoId);
  if (alumnoErr) return { ok: false, code: "fetch_failed", motivo: "No se pudo leer el alumno." };
  if (!alumno) return { ok: false, code: "not_found", motivo: "Alumno no encontrado." };
  if (!alumno.familia?.email) {
    return { ok: false, code: "sin_email", motivo: "La familia no tiene email configurado." };
  }

  const { dias, sesiones, error: diasErr } = await fetchDiasMesYSesiones(admin, tenantId, alumnoId, { mes, anio });
  if (diasErr) return { ok: false, code: "fetch_failed", motivo: "No se pudieron leer las sesiones." };

  const { informe: informeExistente, error: informeErr } = await fetchInformeExistente(admin, tenantId, alumnoId, { mes, anio });
  if (informeErr) return { ok: false, code: "fetch_failed", motivo: "No se pudo leer el informe existente." };

  let comentario = informeExistente?.comentario || null;
  if (!comentario) {
    const sesionesClase = sesiones.filter((s) => s.tipo === "clase");
    if (!sesionesClase.length) {
      return { ok: false, code: "sin_sesiones", motivo: "El alumno no tiene sesiones registradas este mes." };
    }
    const { notas, error: notasErr } = await fetchNotasExamenMes(admin, tenantId, alumnoId, { mes, anio });
    if (notasErr) return { ok: false, code: "fetch_failed", motivo: "No se pudieron leer las notas de examen." };
    try {
      comentario = await generarComentarioInforme(apiKey, { nombre: alumno.nombre, curso: alumno.curso, sesiones: sesionesClase, notas });
    } catch (err) {
      return { ok: false, code: "comentario_failed", motivo: err.message || "No se pudo generar el comentario." };
    }
  }

  const { data: informeGuardado, error: upsertErr } = await admin
    .from("academia_informes")
    .upsert(
      { tenant_id: tenantId, alumno_id: alumnoId, mes, anio, comentario, email_destino: alumno.familia.email },
      { onConflict: "tenant_id,alumno_id,anio,mes" }
    )
    .select("id")
    .single();
  if (upsertErr) return { ok: false, code: "fetch_failed", motivo: "No se pudo guardar el comentario del informe." };

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
    diasMes: dias,
    comentario,
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
    .eq("id", informeGuardado.id);
  if (enviadoErr) {
    return { ok: false, code: "fetch_failed", motivo: "El informe se envió pero no se pudo marcar como enviado." };
  }
  return { ok: true };
}
