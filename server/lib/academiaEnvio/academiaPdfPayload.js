// Traduce academia_config a la forma que espera tutordigital-pdf-service
// (ver app.py / generators/informe.py / generators/recibo.py del
// microservicio) — reubicado desde academiaInformes/payload.js: ahora lo
// usan tanto el PDF de recibo como el de informe (antes solo informe),
// así que vive en el módulo de envío compartido.
//
// `textosExencion`: array de strings ya activos y filtrados por tipo
// ("recibos"/"ambos", ver fetchTextosLegalesActivosPorTipo en
// academiaTextosLegales/consultas.js — la MISMA función que usa el resto
// de generación de recibo/informe, para que el PDF y el email lean
// siempre de la misma fuente). El PDF solo pinta un párrafo, así que
// varios textos activos se unen en uno — si no hay ninguno, se omite: el
// PDF aplica su propio texto por defecto (generators/recibo.py).
//
// No incluye el pie LOPD: decisión de producto 2026-07-30 (ver
// docs/deuda-tecnica.md) — el deber de información del art. 13 se cumple
// en la hoja de inscripción, y recibo/informe viajan como adjuntos de un
// email que ya lleva su propio pie LOPD (ver buildCuerpoHtml). Ningún
// generador del microservicio ha leído nunca ese campo.
export function buildAcademiaPdfPayload(config = {}, tenantNombre = "", textosExencion = []) {
  const nombre = config.nombre_emisor || tenantNombre || "";
  const direccion = [config.direccion_emisor, config.cp_emisor, config.ciudad_emisor].filter(Boolean).join(", ");
  return {
    nombre,
    titular: nombre,
    nif: config.dni_emisor || "",
    direccion,
    telefono: config.telefono_emisor || "",
    email: config.email_emisor || "",
    logo_url: config.logo_url || "",
    texto_exencion: textosExencion.length ? textosExencion.join(" ") : undefined,
  };
}
