import { getBase64FromMaybeDataUrl, approxBase64Bytes } from "../chatValidation.js";

// Archivos del centro que NO puede ver cualquiera con el enlace: la ficha de
// inscripción escaneada de un alumno y la factura de un gasto.
//
// Vive aparte de subirArchivo.js —el de los assets públicos— a propósito: no
// son dos variantes de lo mismo, son dos decisiones distintas. Ahí se sube el
// logo, que TIENE que abrirse sin login porque va incrustado en los correos a
// las familias; aquí se sube el documento firmado de un menor, que no puede.
// Tenerlos en el mismo módulo con una bandera acabaría, el día menos pensado,
// con alguien pasando la bandera al revés.
//
// EL BUCKET ES EL DE NORMAS, no uno nuevo. `academia-documentos` ya es
// privado y ya se sirve así (ver academiaDocumentos/normas.js). Crear un
// segundo bucket privado solo añadiría una cosa más que configurar en cada
// centro nuevo para separar lo que no necesita estar separado.
//
// NUNCA SE DEVUELVE UNA URL. Ni pública ni firmada: se devuelve la RUTA, y
// quien quiere el archivo pasa por una ruta autenticada del backend que lo
// descarga y lo reenvía. Una URL firmada expuesta al navegador vuelve a ser
// un enlace que se puede copiar y pegar fuera de la sesión — más corto de
// vida que el anterior, pero de la misma naturaleza.

export const BUCKET_PRIVADO = "academia-documentos";

export async function subirArchivoPrivado(admin, { path, base64Input, mime, maxBytes }) {
  const base64 = getBase64FromMaybeDataUrl(base64Input);
  if (!base64) return { ok: false, code: "invalid_base64", motivo: "Archivo inválido." };
  if (approxBase64Bytes(base64) > maxBytes) {
    return {
      ok: false,
      code: "payload_too_large",
      motivo: `El archivo supera los ${Math.round(maxBytes / (1024 * 1024))}MB permitidos.`,
    };
  }

  const buf = Buffer.from(base64, "base64");
  const { error } = await admin.storage.from(BUCKET_PRIVADO).upload(path, buf, { contentType: mime, upsert: true });
  if (error) return { ok: false, ...traducirErrorDeStorage(error, mime) };

  return { ok: true, path };
}

// Por qué esto existe en vez de un `upload_failed` a secas.
//
// Hasta el 11/09/2026 cualquier fallo de Storage se convertía en
// `{ code: "upload_failed", motivo: "No se pudo subir el archivo." }`, sin
// guardar ni mirar el error de debajo. Con eso, subir la ficha de un alumno
// llevaba meses respondiendo 500 en producción —el bucket rechazaba las
// imágenes, ver migración 117— y desde el servidor NO HABÍA FORMA de saberlo:
// ni en el log, ni en la respuesta. El diagnóstico salió de los logs de
// Storage de Supabase, que es exactamente el sitio al que no debería haber
// hecho falta ir.
//
// Así que dos cosas: el error se devuelve dentro del resultado (`error`) para
// que la ruta lo escriba en su log, y los dos códigos que son culpa del
// archivo y no del servidor se traducen a lo que ya sabe manejar quien llama
// —415 y 413— en vez de esconderse detrás de un 500 genérico.
export function traducirErrorDeStorage(error, mime = "") {
  const code = String(error?.error || error?.code || "");
  const mensaje = String(error?.message || "");

  if (code === "invalid_mime_type" || /InvalidMimeType|mime type/i.test(code + mensaje)) {
    return {
      code: "unsupported_mime",
      // El mime va en el mensaje a propósito: es el dato que convierte
      // "no se pudo subir" en algo accionable.
      motivo: `El almacén no acepta archivos ${mime || "de este tipo"}.`,
      error,
    };
  }
  if (/EntityTooLarge|exceeded the maximum allowed size|Payload too large/i.test(code + mensaje)) {
    return { code: "payload_too_large", motivo: "El archivo es demasiado grande para el almacén.", error };
  }
  return { code: "upload_failed", motivo: "No se pudo subir el archivo.", error };
}

// Borra un archivo anterior cuya ruta ya no se va a usar. Se llama al
// reemplazar una ficha JPG por un PDF: `upsert` sobrescribe la MISMA ruta, y
// al cambiar la extensión cambia el nombre, así que sin esto el archivo viejo
// se quedaría en el bucket para siempre — con datos de un menor dentro y sin
// ninguna fila que lo referencie, es decir, invisible.
//
// No falla la operación entera si el borrado falla: el archivo nuevo ya está
// subido y la ficha apunta a él. Quedarse un huérfano es peor que nada, pero
// mucho menos malo que devolver un error después de haber guardado bien.
export async function borrarArchivoPrivado(admin, path) {
  if (!path) return;
  try {
    await admin.storage.from(BUCKET_PRIVADO).remove([path]);
  } catch {
    // Silencio a propósito, ver arriba.
  }
}

// Descarga el archivo para que una ruta autenticada lo reenvíe al navegador.
// Devuelve el buffer, no un stream: son fotos de móvil de unos megas y el
// resto del proyecto (normas, hoja de inscripción) ya funciona así.
export async function descargarArchivoPrivado(admin, path) {
  if (!path) return { ok: false, code: "not_found", motivo: "No hay archivo guardado." };
  try {
    const { data, error } = await admin.storage.from(BUCKET_PRIVADO).download(path);
    if (error || !data) return { ok: false, code: "download_failed", motivo: "No se pudo descargar el archivo." };
    return { ok: true, buffer: Buffer.from(await data.arrayBuffer()) };
  } catch (err) {
    return { ok: false, code: "download_failed", motivo: "No se pudo descargar el archivo.", error: err };
  }
}

// El Content-Type con el que se reenvía. Se deduce de la EXTENSIÓN de la
// ruta guardada y no se guarda en la base de datos: la extensión ya la puso
// el propio backend al subir (ver fotoAdjunta.js), así que es tan fiable como
// una columna y no hay dos sitios que puedan discrepar.
const MIME_POR_EXT = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  pdf: "application/pdf",
};

export function mimeDeRuta(path) {
  const ext = String(path || "").split(".").pop()?.toLowerCase();
  return MIME_POR_EXT[ext] || "application/octet-stream";
}
