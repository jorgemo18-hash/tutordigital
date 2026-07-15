import { resolverInscripcionConfig } from "../academiaConfig/inscripcionConfig.js";

// Traduce academia_config (+ el texto legal de protección de datos, ver
// inscripcionTexto.js) a la forma que espera el endpoint /hoja-inscripcion
// de tutordigital-pdf-service (ver generators/hoja_inscripcion.py) — igual
// idea que academiaInformes/payload.js, pero con los campos propios de la
// hoja de inscripción (ciudad, iban, bizum, campos activados, texto de la
// cara trasera) en vez de los de un recibo. inscripcion_config nunca llega
// null al microservicio: se resuelve con los mismos defaults que usa la
// pestaña Ajustes › Inscripción (ver academia.config.routes.js), para que
// un tenant que nunca tocó esa pestaña genere igualmente la hoja completa.
export function buildHojaInscripcionPayload(config = {}, tenantNombre = "", textoLegal = "") {
  return {
    nombre: config.nombre_emisor || tenantNombre || "",
    ciudad: config.ciudad_emisor || "",
    logo_url: config.logo_url || "",
    iban: config.iban || "",
    bizum_emisor: config.bizum_emisor || "",
    campos: resolverInscripcionConfig(config.inscripcion_config),
    texto_legal: textoLegal || "",
  };
}
