// Traduce academia_config a la forma que espera tutordigital-pdf-service
// (ver app.py / generators/informe.py / generators/recibo.py del
// microservicio) — reubicado desde academiaInformes/payload.js: ahora lo
// usan tanto el PDF de recibo como el de informe (antes solo informe),
// así que vive en el módulo de envío compartido.
//
// `textosExencion`/`textosLopd`: arrays de strings ya activos y filtrados
// por tipo ("recibos"/"ambos" y "email"/"ambos" respectivamente, ver
// fetchTextosLegalesActivosPorTipo en academiaTextosLegales/consultas.js —
// la MISMA función que usa el resto de generación de recibo/informe, para
// que el PDF y el email lean siempre de la misma fuente). El PDF solo
// pinta un párrafo, así que varios textos activos del mismo tipo se unen
// en uno — si no hay ninguno, se omite: el PDF aplica su propio texto por
// defecto (generators/recibo.py) y el email simplemente no lleva footer
// LOPD.
export function buildAcademiaPdfPayload(config = {}, tenantNombre = "", textosExencion = [], textosLopd = []) {
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
    lopd_footer: textosLopd.length ? textosLopd.join(" ") : undefined,
  };
}
