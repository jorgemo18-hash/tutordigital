import { sendReciboEmail } from "../email.js";
import { fetchReciboCompleto } from "../academiaRecibos/consultas.js";
import { fetchInformeExistente } from "../academiaInformes/consultas.js";
import { fetchDiasMesYSesiones } from "../academiaInformes/diasMes.js";
import { fetchTextosLegalesActivosPorTipo } from "../academiaTextosLegales/consultas.js";
import { fetchConfigEnvio, fetchFamiliaConAlumnosActivos, fetchReciboIdDeFamiliaDelMes } from "./consultas.js";
import { buildAcademiaPdfPayload } from "./academiaPdfPayload.js";
import { buildReciboPdfPayload } from "./reciboPdfPayload.js";
import { buildInformePdfPayload } from "./informePdfPayload.js";
import { generarReciboPdf, generarInformePdf } from "./generarPdfs.js";
import { nombreArchivoRecibo, nombreArchivoInforme } from "./nombresArchivo.js";
import { sustituirVariables, MESES } from "./textoAcompanamiento.js";
import { buildCuerpoHtml, capitaliza } from "./cuerpoEmail.js";

// Envío combinado por familia (Parte 3): recibo PDF (si existe ese mes) +
// informe PDF de cada alumno activo que YA tenga informe generado —
// un único email, con solo los adjuntos que se pudieron generar
// (degradación elegante: un fallo puntual del microservicio nunca bloquea
// el envío del resto). Solo se marca `enviado`/`enviado_at` lo que
// realmente se adjuntó y envió. Dependencias inyectables para tests.
export async function enviarReciboYInformesDeFamilia(admin, {
  tenantId, tenantNombre, familiaId, mes, anio, pdfServiceUrl,
  generarReciboPdfFn = generarReciboPdf,
  generarInformePdfFn = generarInformePdf,
  enviarEmailFn = sendReciboEmail,
}) {
  const { familia, alumnosActivos, error: familiaErr } = await fetchFamiliaConAlumnosActivos(admin, tenantId, familiaId);
  if (familiaErr) return { ok: false, code: "fetch_failed", motivo: "No se pudo leer la familia." };
  if (!familia) return { ok: false, code: "not_found", motivo: "Familia no encontrada." };
  if (!familia.email) return { ok: false, code: "sin_email", motivo: "La familia no tiene email configurado.", familiaNombre: familia.nombre };

  const [config, textosLopd, textosExencion] = await Promise.all([
    fetchConfigEnvio(admin, tenantId),
    fetchTextosLegalesActivosPorTipo(admin, tenantId, "email"),
    fetchTextosLegalesActivosPorTipo(admin, tenantId, "recibos"),
  ]);
  const academiaPayload = buildAcademiaPdfPayload(config, tenantNombre, textosExencion, textosLopd);

  const { reciboId, error: reciboIdErr } = await fetchReciboIdDeFamiliaDelMes(admin, tenantId, familiaId, { mes, anio });
  if (reciboIdErr) return { ok: false, code: "fetch_failed", motivo: "No se pudo comprobar el recibo del mes." };

  let recibo = null;
  let reciboBuffer = null;
  if (reciboId) {
    const { data: reciboCompleto, error: reciboErr } = await fetchReciboCompleto(admin, tenantId, reciboId);
    if (reciboErr) return { ok: false, code: "fetch_failed", motivo: "No se pudo leer el recibo." };
    recibo = reciboCompleto;
    if (recibo) {
      const resultado = await generarReciboPdfFn({
        tenantId, familiaId, pdfServiceUrl,
        payload: { ...buildReciboPdfPayload(recibo), academia: academiaPayload },
      });
      if (resultado.ok) reciboBuffer = resultado.buffer;
    }
  }

  const informesAdjuntados = [];
  for (const alumno of alumnosActivos) {
    const { informe, error: informeErr } = await fetchInformeExistente(admin, tenantId, alumno.id, { mes, anio });
    if (informeErr || !informe?.comentario) continue;
    const { dias, error: diasErr } = await fetchDiasMesYSesiones(admin, tenantId, alumno.id, { mes, anio });
    if (diasErr) continue;
    const resultado = await generarInformePdfFn({
      tenantId, alumnoId: alumno.id, pdfServiceUrl,
      payload: buildInformePdfPayload({ alumno, mes, anio, dias, comentario: informe.comentario, academiaPayload }),
    });
    if (resultado.ok) informesAdjuntados.push({ alumnoId: alumno.id, informeId: informe.id, nombre: alumno.nombre, buffer: resultado.buffer });
  }

  if (!reciboBuffer && !informesAdjuntados.length) {
    return { ok: false, code: "sin_contenido", motivo: "No se pudo generar ningún documento para enviar." };
  }

  const total = recibo ? recibo.total_neto : undefined;
  const cuerpo = sustituirVariables(config.email_texto_acompanamiento, { mes, anio, total, familia: familia.nombre });
  const html = buildCuerpoHtml(cuerpo, textosLopd);

  const attachments = [];
  if (reciboBuffer) attachments.push({ filename: nombreArchivoRecibo(familia.nombre, mes, anio), content: reciboBuffer });
  for (const inf of informesAdjuntados) attachments.push({ filename: nombreArchivoInforme(inf.nombre, mes, anio), content: inf.buffer });

  try {
    await enviarEmailFn({
      to: familia.email,
      subject: `${tenantNombre} · ${capitaliza(MESES[mes])} ${anio}`,
      html,
      attachments,
    });
  } catch (err) {
    return { ok: false, code: "send_failed", motivo: err.message || "Fallo al enviar el email.", familiaNombre: familia.nombre };
  }

  if (reciboBuffer) {
    await admin
      .from("academia_recibos")
      .update({ estado: "enviado", fecha_envio: new Date().toISOString() })
      .eq("id", reciboId)
      .eq("tenant_id", tenantId);
  }
  for (const inf of informesAdjuntados) {
    await admin.from("academia_informes").update({ enviado_at: new Date().toISOString() }).eq("id", inf.informeId);
  }

  return { ok: true, reciboAdjuntado: Boolean(reciboBuffer), informesAdjuntados: informesAdjuntados.length };
}
