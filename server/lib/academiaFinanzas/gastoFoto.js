import { subirFotoAdjunta, MAX_FOTO_BYTES, ALLOWED_FOTO_MIMES } from "../academiaStorage/fotoAdjunta.js";

// Re-exportados para no romper a quien ya los importaba desde aquí; la
// implementación vive en academiaStorage/fotoAdjunta.js, compartida con la
// ficha de inscripción del alumno.
export { MAX_FOTO_BYTES, ALLOWED_FOTO_MIMES };

// Sube la foto/PDF de una factura a academia-assets/{tenant}/gastos/{id}.{ext}
// y actualiza academia_gastos.foto_url.
export async function subirFotoGasto(admin, { tenantId, id, base64Input, mime }) {
  return subirFotoAdjunta(admin, {
    tenantId,
    id,
    carpeta: "gastos",
    tabla: "academia_gastos",
    columna: "foto_url",
    base64Input,
    mime,
    mensajeMime: "Solo se aceptan imágenes JPG/PNG/WEBP/HEIC/DNG o PDF.",
  });
}
