import { fetchConfigHojaInscripcion } from "./consultas.js";
import { fetchTextoInscripcion } from "./inscripcionTexto.js";
import { buildHojaInscripcionPayload } from "./payload.js";
import { Sentry } from "../sentry.js";

// Incrementar SIEMPRE que cambie el output del generador en
// tutordigital-pdf-service (layout, contenido, espaciado) — si no se
// incrementa, el caché servirá PDFs con el formato antiguo: el hash de
// caché (ver hashHojaInscripcion.js) se calcula sobre los datos de
// entrada de la plantilla, así que un cambio que solo toca cómo el
// microservicio los dibuja (sin tocar config/texto/logo del tenant) no
// cambia el hash por sí solo y el PDF viejo se seguiría sirviendo
// indefinidamente tras desplegar la nueva versión del generador.
export const PLANTILLA_HOJA_INSCRIPCION_VERSION = 3;

// Punto único que recopila TODO lo que alimenta la plantilla de la hoja
// de inscripción — configuración de campos activados, texto de
// protección de datos, y datos del centro (nombre, ciudad, iban, bizum,
// logo). El resultado es exactamente lo que se envía al microservicio
// (ver generarHojaInscripcion.js) y también lo que se hashea para el
// caché (ver hashHojaInscripcion.js): mismo objeto, dos usos, para que
// nunca puedan desincronizarse ("el hash dice que no cambió nada" pero
// en realidad el payload real llevaba un campo distinto).
//
// logo_url ya incluye un ?v=<timestamp> que cambia en cada subida nueva
// (ver academiaConfig/uploadAsset.js) — sirve como versión del logo sin
// tener que leer aparte su metadata de Storage; no hace falta más que
// incluir el valor tal cual en el payload para que el hash cambie cuando
// el logo cambia.
//
// Un fallo leyendo el texto legal no debe tumbar la generación del PDF —
// se genera sin cara trasera (texto vacío) en vez de devolver un error
// por algo que ni siquiera es obligatorio (puede no haber texto subido
// todavía).
export async function construirPayloadHojaInscripcion(admin, { tenantId, tenantNombre }) {
  const config = await fetchConfigHojaInscripcion(admin, tenantId);
  const { contenido: textoLegal, error: textoLegalErr } = await fetchTextoInscripcion(admin, tenantId);
  if (textoLegalErr) {
    Sentry.captureException(new Error("No se pudo leer el texto legal de la hoja de inscripción"), {
      extra: { operation: "fetch_texto_inscripcion", tenantId, error: textoLegalErr },
    });
  }
  return {
    academia: buildHojaInscripcionPayload(config, tenantNombre, textoLegal),
    plantilla_version: PLANTILLA_HOJA_INSCRIPCION_VERSION,
  };
}
