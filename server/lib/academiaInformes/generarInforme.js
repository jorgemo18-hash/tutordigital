import { fetchAlumnoConFamilia, fetchNotasExamenMes, fetchInformeExistente } from "./consultas.js";
import { fetchDiasMesYSesiones } from "./diasMes.js";
import { generarComentarioInforme } from "./generarComentario.js";
import { Sentry } from "../sentry.js";

const SIN_ACTIVIDAD = "Sin actividad registrada este mes.";

// Genera (o reutiliza, si ya existe y no se fuerza) el comentario del
// informe de un alumno y lo guarda en academia_informes — sin tocar el
// microservicio de PDF ni marcar como enviado. La usan tanto el botón
// "Generar/Regenerar informe" (solo generar) como enviarInforme.js (genera
// si falta, justo antes de enviar) — único punto de la lógica de Claude.
export async function generarYGuardarComentario(admin, { tenantId, alumnoId, mes, anio, apiKey, forzar = false }) {
  const { alumno, error: alumnoErr } = await fetchAlumnoConFamilia(admin, tenantId, alumnoId);
  if (alumnoErr) return { ok: false, code: "fetch_failed", motivo: "No se pudo leer el alumno." };
  if (!alumno) return { ok: false, code: "not_found", motivo: "Alumno no encontrado." };

  const { dias, sesiones, error: diasErr } = await fetchDiasMesYSesiones(admin, tenantId, alumnoId, { mes, anio });
  if (diasErr) return { ok: false, code: "fetch_failed", motivo: "No se pudieron leer las sesiones." };

  let comentario;
  // Sin ningún día que informar (ni clases ni festivos) no hay nada que
  // resumir — comentario fijo, determinista, sin gastar la llamada a
  // Claude (ni falta leer el informe existente ni las notas de examen: da
  // igual `forzar`, el resultado es siempre el mismo texto).
  if (!dias.length) {
    comentario = SIN_ACTIVIDAD;
  } else {
    const { informe: informeExistente, error: informeErr } = await fetchInformeExistente(admin, tenantId, alumnoId, { mes, anio });
    if (informeErr) return { ok: false, code: "fetch_failed", motivo: "No se pudo leer el informe existente." };

    comentario = forzar ? null : informeExistente?.comentario || null;
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
        // Único punto de captura para el fallo de Claude dentro de
        // generarComentarioInforme (ese módulo no tiene try/catch propio)
        // y para el fallo de generación del informe en sí — es el mismo
        // catch en el código real.
        Sentry.captureException(err, {
          extra: { operation: "generar_comentario_informe", tenantId, alumnoId, mes, anio },
        });
        return { ok: false, code: "comentario_failed", motivo: err.message || "No se pudo generar el comentario." };
      }
    }
  }

  const { data: informeGuardado, error: upsertErr } = await admin
    .from("academia_informes")
    .upsert(
      { tenant_id: tenantId, alumno_id: alumnoId, mes, anio, comentario, email_destino: alumno.familia?.email || null },
      { onConflict: "tenant_id,alumno_id,anio,mes" }
    )
    .select("id, enviado_at")
    .single();
  if (upsertErr) return { ok: false, code: "fetch_failed", motivo: "No se pudo guardar el comentario del informe." };

  return { ok: true, informeId: informeGuardado.id, comentario, dias, enviadoAt: informeGuardado.enviado_at };
}
