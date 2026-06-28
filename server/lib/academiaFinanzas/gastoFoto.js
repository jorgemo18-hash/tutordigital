import { subirArchivoAcademiaAssets } from "../academiaStorage/subirArchivo.js";

export const MAX_FOTO_BYTES = 8 * 1024 * 1024;
const EXT_POR_MIME = { "image/jpeg": "jpg", "image/png": "png", "application/pdf": "pdf" };
export const ALLOWED_FOTO_MIMES = new Set(Object.keys(EXT_POR_MIME));

// Sube la foto/PDF de una factura a academia-assets/{tenant}/gastos/{id}.{ext}
// y actualiza academia_gastos.foto_url con la URL resultante. `id` puede ser
// el id real de un gasto existente (modo edición) o un UUID temporal
// generado en el frontend antes de crear el gasto (flujo de OCR, ver
// gastoUpload.js) — en ese segundo caso el UPDATE no encuentra ninguna fila
// y no hace nada, lo cual no es un error: la URL se devuelve igual para que
// el frontend la incluya luego en el payload de creación.
export async function subirFotoGasto(admin, { tenantId, id, base64Input, mime }) {
  if (!ALLOWED_FOTO_MIMES.has(mime)) {
    return { ok: false, code: "unsupported_mime", motivo: "Solo se aceptan imágenes JPG/PNG o PDF." };
  }

  const path = `${tenantId}/gastos/${id}.${EXT_POR_MIME[mime]}`;
  const subida = await subirArchivoAcademiaAssets(admin, { path, base64Input, mime, maxBytes: MAX_FOTO_BYTES });
  if (!subida.ok) return subida;

  const { error: dbErr } = await admin
    .from("academia_gastos")
    .update({ foto_url: subida.url })
    .eq("id", id)
    .eq("tenant_id", tenantId);
  if (dbErr) return { ok: false, code: "db_update_failed", motivo: "No se pudo guardar la foto en el gasto." };

  return { ok: true, url: subida.url };
}
