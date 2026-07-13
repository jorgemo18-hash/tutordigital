// Traduce academia_config a la forma que espera el endpoint /hoja-inscripcion
// de tutordigital-pdf-service (ver generators/hoja_inscripcion.py) — igual
// idea que academiaInformes/payload.js, pero con los campos propios de la
// hoja de inscripción (ciudad, iban, bizum) en vez de los de un recibo.
export function buildHojaInscripcionPayload(config = {}, tenantNombre = "") {
  return {
    nombre: config.nombre_emisor || tenantNombre || "",
    ciudad: config.ciudad_emisor || "",
    logo_url: config.logo_url || "",
    iban: config.iban || "",
    bizum_emisor: config.bizum_emisor || "",
  };
}
