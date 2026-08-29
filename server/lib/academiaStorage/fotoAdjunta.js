import { subirArchivoAcademiaAssets } from "./subirArchivo.js";
import { convertirHeicBase64 } from "./heicConverter.js";

// Adjuntar una foto/PDF a una fila del centro y guardar su URL en la tabla
// que sea. Lo usan la factura de un gasto (academia_gastos.foto_url) y la
// ficha de inscripción de un alumno (academia_alumnos.ficha_url): mismo
// bucket, mismas conversiones, mismos límites y mismos códigos de error.
//
// Estaba escrito solo para gastos. Al añadir la ficha del alumno había dos
// opciones: copiarlo entero o extraerlo. Copiado, cualquier arreglo futuro
// (un formato nuevo, un límite distinto, un fallo de conversión) habría que
// hacerlo dos veces y una de las dos se quedaría atrás.

export const MAX_FOTO_BYTES = 31_457_280; // 30 MB — igual que el bodyLimit global de Fastify

// HEIC/HEIF/DNG se convierten a JPEG antes de subir, por eso su extensión es "jpg".
const EXT_POR_MIME = {
  "image/jpeg":        "jpg",
  "image/png":         "png",
  "image/webp":        "webp",
  "application/pdf":   "pdf",
  "image/heic":        "jpg",
  "image/heif":        "jpg",
  "image/x-adobe-dng": "jpg",
  "image/dng":         "jpg",
};
export const ALLOWED_FOTO_MIMES = new Set(Object.keys(EXT_POR_MIME));

// Sube a academia-assets/{tenant}/{carpeta}/{id}.{ext} y escribe la URL
// pública en `tabla`.`columna` de esa fila (acotada por tenant, nunca por id
// a secas). Si el servidor no tiene soporte RAW para un DNG, el converter
// lanza con un mensaje claro que llega al cliente como 422.
export async function subirFotoAdjunta(admin, {
  tenantId, id, carpeta, tabla, columna, base64Input, mime, mensajeMime,
}) {
  if (!ALLOWED_FOTO_MIMES.has(mime)) {
    return { ok: false, code: "unsupported_mime", motivo: mensajeMime || "Formato de archivo no admitido." };
  }

  let b64Final, mimeFinal;
  try {
    ({ base64: b64Final, mime: mimeFinal } = await convertirHeicBase64(base64Input, mime));
  } catch (err) {
    return { ok: false, code: "conversion_failed", motivo: err.message };
  }

  const path = `${tenantId}/${carpeta}/${id}.${EXT_POR_MIME[mime]}`;
  const subida = await subirArchivoAcademiaAssets(admin, {
    path, base64Input: b64Final, mime: mimeFinal, maxBytes: MAX_FOTO_BYTES,
  });
  if (!subida.ok) return subida;

  const { error: dbErr } = await admin
    .from(tabla)
    .update({ [columna]: subida.url })
    .eq("id", id)
    .eq("tenant_id", tenantId);
  if (dbErr) return { ok: false, code: "db_update_failed", motivo: "No se pudo guardar el archivo en la ficha." };

  return { ok: true, url: subida.url };
}
