import { sendReciboEmail } from "../email.js";
import { fetchAlumnoConFamilia, fetchInformeExistente } from "../academiaInformes/consultas.js";
import { generarYGuardarComentario } from "../academiaInformes/generarInforme.js";
import { fetchTextosLegalesActivosPorTipo } from "../academiaTextosLegales/consultas.js";
import { fetchConfigEnvio } from "./consultas.js";
import { buildAcademiaPdfPayload } from "./academiaPdfPayload.js";
import { buildInformePdfPayload } from "./informePdfPayload.js";
import { generarInformePdf } from "./generarPdfs.js";
import { nombreArchivoInforme } from "./nombresArchivo.js";
import { sustituirVariables, MESES, DEFAULT_TEXTO_SOLO_INFORME } from "./textoAcompanamiento.js";
import { buildCuerpoHtml, capitaliza } from "./cuerpoEmail.js";

// Envío individual de informe (Parte 4): solo el informe de ESE alumno,
// sin recibo, email aparte del envío por familia. Política forward-only:
// si ya se envió antes y no se confirma, no se toca nada. A diferencia del
// envío por familia, aquí solo hay un PDF posible — si falla, no hay nada
// con lo que seguir, así que no se envía.
export async function enviarInformeDeAlumno(admin, {
  tenantId, tenantNombre, alumnoId, mes, anio, apiKey, pdfServiceUrl, confirmar = false,
  generarInformePdfFn = generarInformePdf,
  enviarEmailFn = sendReciboEmail,
}) {
  const { alumno, error: alumnoErr } = await fetchAlumnoConFamilia(admin, tenantId, alumnoId);
  if (alumnoErr) return { ok: false, code: "fetch_failed", motivo: "No se pudo leer el alumno." };
  if (!alumno) return { ok: false, code: "not_found", motivo: "Alumno no encontrado." };
  if (!alumno.familia?.email) return { ok: false, code: "sin_email", motivo: "La familia no tiene email configurado." };

  const { informe: previo, error: previoErr } = await fetchInformeExistente(admin, tenantId, alumnoId, { mes, anio });
  if (previoErr) return { ok: false, code: "fetch_failed", motivo: "No se pudo comprobar el informe existente." };
  if (previo?.enviado_at && !confirmar) {
    return { ok: false, code: "requiere_confirmacion", motivo: "Este informe ya se envió", enviado_at: previo.enviado_at };
  }

  const generado = await generarYGuardarComentario(admin, { tenantId, alumnoId, mes, anio, apiKey });
  if (!generado.ok) return generado;

  const [config, textosLopd, textosExencion] = await Promise.all([
    fetchConfigEnvio(admin, tenantId),
    fetchTextosLegalesActivosPorTipo(admin, tenantId, "email"),
    fetchTextosLegalesActivosPorTipo(admin, tenantId, "recibos"),
  ]);
  const academiaPayload = buildAcademiaPdfPayload(config, tenantNombre, textosExencion);

  const resultado = await generarInformePdfFn({
    tenantId, alumnoId, pdfServiceUrl,
    payload: buildInformePdfPayload({ alumno, mes, anio, dias: generado.dias, comentario: generado.comentario, academiaPayload }),
  });
  if (!resultado.ok) return { ok: false, code: "pdf_failed", motivo: resultado.motivo || "No se pudo generar el PDF del informe." };

  // Envío individual: siempre "solo informe" — su propio texto configurable
  // (sin {total}, aquí nunca hay recibo), mismo caso que un envío por
  // familia con tipoEnvio "solo_informe" (ver enviarFamiliaEmail.js).
  const cuerpo = sustituirVariables(
    config.email_texto_solo_informe,
    { mes, anio, total: undefined, familia: alumno.familia?.nombre },
    DEFAULT_TEXTO_SOLO_INFORME
  );
  const html = buildCuerpoHtml(cuerpo, textosLopd);
  const attachments = [{ filename: nombreArchivoInforme(alumno.nombre, mes, anio), content: resultado.buffer }];

  try {
    await enviarEmailFn({
      to: alumno.familia.email,
      subject: `${tenantNombre} · ${capitaliza(MESES[mes])} ${anio}`,
      html,
      attachments,
    });
  } catch (err) {
    return { ok: false, code: "send_failed", motivo: err.message || "Fallo al enviar el email." };
  }

  const { error: updateErr } = await admin
    .from("academia_informes")
    .update({ enviado_at: new Date().toISOString() })
    .eq("id", generado.informeId);
  if (updateErr) return { ok: false, code: "fetch_failed", motivo: "El informe se envió pero no se pudo marcar como enviado." };

  return { ok: true };
}
