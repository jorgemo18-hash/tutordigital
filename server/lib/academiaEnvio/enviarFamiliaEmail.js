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
import { sustituirVariables, MESES, DEFAULT_TEXTO_COMPLETO, DEFAULT_TEXTO_SOLO_RECIBO, DEFAULT_TEXTO_SOLO_INFORME } from "./textoAcompanamiento.js";
import { buildCuerpoHtml, capitaliza } from "./cuerpoEmail.js";
import { evaluarConfirmacionEnvioFamilia } from "./confirmacionEnvioFamilia.js";
import { estadoTrasEnvio } from "../academiaRecibos/estadoEnvio.js";
import { buildRemitente } from "./remitente.js";

const TEXTO_POR_TIPO = {
  completo: { campo: "email_texto_completo", fallback: DEFAULT_TEXTO_COMPLETO },
  solo_recibo: { campo: "email_texto_solo_recibo", fallback: DEFAULT_TEXTO_SOLO_RECIBO },
  solo_informe: { campo: "email_texto_solo_informe", fallback: DEFAULT_TEXTO_SOLO_INFORME },
};

// Envío combinado por familia: qué documentos entran depende de
// `tipoEnvio` ("completo" por defecto: recibo + informe de cada alumno
// activo que ya tenga informe generado; "solo_recibo"/"solo_informe": solo
// ese tipo, sin siquiera intentar generar el otro) — un único email, con
// solo los adjuntos que se pudieron generar (degradación elegante: un
// fallo puntual del microservicio nunca bloquea el resto). Política
// forward-only: si algún documento del tipo elegido ya está enviado/pagado
// y no se confirma, no se genera ni se envía nada (ver
// confirmacionEnvioFamilia.js) — la comprobación va ANTES de generar
// ningún PDF, igual que enviarInformeIndividual.js. Solo se marca
// `enviado`/`enviado_at` lo que realmente se adjuntó y envió. Dependencias
// inyectables para tests.
export async function enviarReciboYInformesDeFamilia(admin, {
  tenantId, tenantNombre, familiaId, mes, anio, pdfServiceUrl,
  tipoEnvio = "completo",
  confirmar = false,
  generarReciboPdfFn = generarReciboPdf,
  generarInformePdfFn = generarInformePdf,
  enviarEmailFn = sendReciboEmail,
}) {
  const incluyeRecibo = tipoEnvio !== "solo_informe";
  const incluyeInformes = tipoEnvio !== "solo_recibo";

  const { familia, alumnosActivos, error: familiaErr } = await fetchFamiliaConAlumnosActivos(admin, tenantId, familiaId);
  if (familiaErr) return { ok: false, code: "fetch_failed", motivo: "No se pudo leer la familia." };
  if (!familia) return { ok: false, code: "not_found", motivo: "Familia no encontrada." };
  if (!familia.email) return { ok: false, code: "sin_email", motivo: "La familia no tiene email configurado.", familiaNombre: familia.nombre };

  let recibo = null;
  if (incluyeRecibo) {
    const { reciboId, error: reciboIdErr } = await fetchReciboIdDeFamiliaDelMes(admin, tenantId, familiaId, { mes, anio });
    if (reciboIdErr) return { ok: false, code: "fetch_failed", motivo: "No se pudo comprobar el recibo del mes." };
    if (reciboId) {
      const { data: reciboCompleto, error: reciboErr } = await fetchReciboCompleto(admin, tenantId, reciboId);
      if (reciboErr) return { ok: false, code: "fetch_failed", motivo: "No se pudo leer el recibo." };
      recibo = reciboCompleto;
    }
  }

  // Solo se consideran "elegibles" (y por tanto solo estos cuentan para la
  // confirmación forward-only) los alumnos que YA tienen un informe con
  // comentario generado — uno sin comentario no iba a enviarse de todos
  // modos, así que no puede "requerir confirmación".
  const informesElegibles = [];
  if (incluyeInformes) {
    for (const alumno of alumnosActivos) {
      const { informe, error: informeErr } = await fetchInformeExistente(admin, tenantId, alumno.id, { mes, anio });
      if (informeErr) return { ok: false, code: "fetch_failed", motivo: "No se pudo comprobar los informes." };
      if (!informe?.comentario) continue;
      informesElegibles.push({ alumno, informe });
    }
  }

  const { requiereConfirmacion, afectados } = evaluarConfirmacionEnvioFamilia({
    reciboEstado: recibo?.estado ?? null,
    informesEnviadosAt: informesElegibles.map(({ informe }) => informe.enviado_at),
    tipoEnvio,
    confirmar,
  });
  if (requiereConfirmacion) {
    return { ok: false, code: "requiere_confirmacion", motivo: "Hay documentos de este envío ya enviados.", afectados, familiaNombre: familia.nombre };
  }

  const [config, textosLopd, textosExencion] = await Promise.all([
    fetchConfigEnvio(admin, tenantId),
    fetchTextosLegalesActivosPorTipo(admin, tenantId, "email"),
    fetchTextosLegalesActivosPorTipo(admin, tenantId, "recibos"),
  ]);
  const academiaPayload = buildAcademiaPdfPayload(config, tenantNombre, textosExencion);

  // Recibo e informes se generan en SECUENCIA (await uno detrás de otro,
  // nunca Promise.all) a propósito — decisión temporal, ligada al plan
  // free de Render de tutordigital-pdf-service (512MB, recursos
  // compartidos). Dos conversiones de LibreOffice a la vez ya se ha visto
  // que degradan mucho el tiempo de respuesta bajo ese plan y parecen
  // contribuir a los 429 "Too Many Requests" que devuelve la capa delante
  // del microservicio (Cloudflare/Render) ante ráfagas de peticiones —
  // diagnóstico completo en TUTORDIGITAL-BACKEND-B/C. Al pasar a un plan
  // de pago con más CPU/memoria dedicada, revisar si conviene volver a
  // generar recibo + informes en paralelo (Promise.all) o, si el volumen
  // de familias con varios hermanos lo justifica, un híbrido (paralelo
  // solo para el recibo + el primer informe, resto en cola).
  let reciboBuffer = null;
  if (recibo) {
    const resultado = await generarReciboPdfFn({
      tenantId, familiaId, pdfServiceUrl,
      payload: { ...buildReciboPdfPayload(recibo), academia: academiaPayload },
    });
    if (resultado.ok) reciboBuffer = resultado.buffer;
  }

  const informesAdjuntados = [];
  for (const { alumno, informe } of informesElegibles) {
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

  const { campo, fallback } = TEXTO_POR_TIPO[tipoEnvio];
  const total = recibo ? recibo.total_neto : undefined;
  const cuerpo = sustituirVariables(config[campo], { mes, anio, total, familia: familia.nombre }, fallback);
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
      ...buildRemitente(config, tenantNombre),
    });
  } catch (err) {
    return { ok: false, code: "send_failed", motivo: err.message || "Fallo al enviar el email.", familiaNombre: familia.nombre };
  }

  // El email ya salió: a partir de aquí ningún fallo puede "deshacerlo", así
  // que los errores de estos UPDATE no anulan el envío — se acumulan y se
  // devuelven como aviso. Antes se ignoraban por completo, y un email
  // enviado cuyo recibo no llegó a marcarse hacía que el admin lo reenviara
  // y la familia lo recibiera dos veces.
  const avisosEstado = [];

  if (reciboBuffer) {
    const { error: reciboUpdErr } = await admin
      .from("academia_recibos")
      .update({ estado: estadoTrasEnvio(recibo.estado), fecha_envio: new Date().toISOString() })
      .eq("id", recibo.id)
      .eq("tenant_id", tenantId);
    if (reciboUpdErr) avisosEstado.push("el recibo se envió pero no se pudo marcar como enviado");
  }
  for (const inf of informesAdjuntados) {
    const { error: informeUpdErr } = await admin
      .from("academia_informes")
      .update({ enviado_at: new Date().toISOString() })
      .eq("id", inf.informeId);
    if (informeUpdErr) avisosEstado.push(`el informe de ${inf.nombre} se envió pero no se pudo marcar como enviado`);
  }

  return {
    ok: true,
    reciboAdjuntado: Boolean(reciboBuffer),
    informesAdjuntados: informesAdjuntados.length,
    informesElegibles: informesElegibles.length,
    avisosEstado,
  };
}
