import { getBase64FromMaybeDataUrl, approxBase64Bytes } from "../chatValidation.js";

const BUCKET = "academia-assets";

// Sube bytes (base64) a una ruta concreta del bucket academia-assets y
// devuelve su URL pública. No toca ninguna tabla — quien llama decide
// dónde persistir la URL resultante (academia_config, academia_gastos...).
// `upsert: true` sobrescribe si ya existe un archivo en esa misma ruta; el
// ?v= cambia en cada subida para que el navegador no sirva desde caché una
// versión vieja servida bajo la misma URL.
export async function subirArchivoAcademiaAssets(admin, { path, base64Input, mime, maxBytes }) {
  const base64 = getBase64FromMaybeDataUrl(base64Input);
  if (!base64) return { ok: false, code: "invalid_base64", motivo: "Archivo inválido." };
  if (approxBase64Bytes(base64) > maxBytes) {
    return { ok: false, code: "payload_too_large", motivo: `El archivo supera los ${Math.round(maxBytes / (1024 * 1024))}MB permitidos.` };
  }

  const buf = Buffer.from(base64, "base64");
  const { error: uploadErr } = await admin.storage.from(BUCKET).upload(path, buf, { contentType: mime, upsert: true });
  if (uploadErr) return { ok: false, code: "upload_failed", motivo: "No se pudo subir el archivo." };

  const { data: pub } = admin.storage.from(BUCKET).getPublicUrl(path);
  if (!pub?.publicUrl) return { ok: false, code: "public_url_failed", motivo: "No se pudo generar la URL pública." };

  return { ok: true, url: `${pub.publicUrl}?v=${Date.now()}` };
}
