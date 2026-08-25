import { extraerJsonConVision } from "./anthropicVisionOcr.js";

// El prompt refleja la ESTRUCTURA REAL de la hoja de inscripción (ver
// academiaConfig/inscripcionConfig.js): un bloque de alumno y otro de
// familia/tutor, cada uno con su propio nombre, email y teléfono.
//
// La versión anterior pedía un JSON plano con un único "nombre", "email" y
// "telefono". Con una hoja que lleva DOS de cada, el modelo tenía que
// adivinar cuál devolver, y lo que devolvía se aplicaba siempre al alumno:
// el nombre del tutor, su DNI, su dirección y su teléfono se perdían, y el
// admin los reescribía a mano en cada alta.
//
// Pedir la misma estructura que tiene el papel elimina la ambigüedad en
// origen, que es más fiable que intentar repartir después un objeto plano.
const EXTRACTION_PROMPT = `Extrae los datos de esta ficha de inscripción de una academia.

La ficha tiene dos bloques de datos personales: los del ALUMNO y los del TUTOR o familia (padre, madre o tutor legal). Cada bloque puede tener su propio nombre, email y teléfono: no los mezcles. Si un dato aparece una sola vez y no está claro a qué bloque pertenece, decide por el contexto de la ficha; si sigue sin estar claro, déjalo vacío.

Devuelve SOLO este JSON, con "" en cualquier campo que no encuentres con seguridad:
{
  "alumno": {
    "nombre": "",
    "curso": "",
    "email": "",
    "telefono": "",
    "direccion": "",
    "ciudad": "",
    "codigo_postal": ""
  },
  "familia": {
    "nombre_tutor": "",
    "apellidos": "",
    "dni": "",
    "email": "",
    "telefono": "",
    "direccion": "",
    "ciudad": "",
    "codigo_postal": ""
  },
  "metodo_pago": ""
}

Reglas:
- "curso" es el curso escolar del alumno (ejemplos: "1º ESO", "3º PRIM", "2º BACH").
- "nombre_tutor" es solo el nombre de pila del tutor; "apellidos" son sus apellidos.
- "dni" es el documento del TUTOR, no el del alumno.
- Para "metodo_pago" usa exactamente uno de: "bizum", "transferencia", "efectivo", "sepa".
- Si la dirección solo aparece una vez en la ficha, ponla en el bloque de familia.

Devuelve solo el JSON, sin explicaciones.`;

// Extrae los campos de una ficha de inscripción en papel — mismo patrón que
// la extracción de gastos (academiaFinanzas/gastoExtraccion.js), con su
// propio prompt. La llamada a Claude + parseo de JSON vive en
// anthropicVisionOcr.js, compartida por ambas. La normalización de la
// respuesta (formato antiguo, nombre compuesto del tutor, metodo_pago)
// vive en academiaInscripciones/normalizarDatosOcr.js.
export async function extraerDatosInscripcion(client, { base64, mediaType }) {
  return extraerJsonConVision(client, { base64, mediaType, prompt: EXTRACTION_PROMPT });
}
