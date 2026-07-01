import { subirArchivoAcademiaAssets } from "../academiaStorage/subirArchivo.js";
import { convertirHeicBase64 } from "./heicConverter.js";

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

// Sube la foto/PDF de una factura a academia-assets/{tenant}/gastos/{id}.{ext}
// y actualiza academia_gastos.foto_url. HEIC/HEIF/DNG se convierten a JPEG
// antes de subir — si el servidor no tiene soporte RAW para DNG, el converter
// lanza un error con mensaje claro que llega al cliente como 422.
export async function subirFotoGasto(admin, { tenantId, id, base64Input, mime }) {
  if (!ALLOWED_FOTO_MIMES.has(mime)) {
    return { ok: false, code: "unsupported_mime", motivo: "Solo se aceptan imágenes JPG/PNG/WEBP/HEIC/DNG o PDF." };
  }

  let b64Final, mimeFinal;
  try {
    ({ base64: b64Final, mime: mimeFinal } = await convertirHeicBase64(base64Input, mime));
  } catch (err) {
    return { ok: false, code: "conversion_failed", motivo: err.message };
  }

  const path = `${tenantId}/gastos/${id}.${EXT_POR_MIME[mime]}`;
  const subida = await subirArchivoAcademiaAssets(admin, { path, base64Input: b64Final, mime: mimeFinal, maxBytes: MAX_FOTO_BYTES });
  if (!subida.ok) return subida;

  const { error: dbErr } = await admin
    .from("academia_gastos")
    .update({ foto_url: subida.url })
    .eq("id", id)
    .eq("tenant_id", tenantId);
  if (dbErr) return { ok: false, code: "db_update_failed", motivo: "No se pudo guardar la foto en el gasto." };

  return { ok: true, url: subida.url };
}
