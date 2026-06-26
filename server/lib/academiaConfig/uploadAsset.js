import { getBase64FromMaybeDataUrl, approxBase64Bytes } from "../chatValidation.js";

const BUCKET = "academia-assets";
export const MAX_ASSET_BYTES = 5 * 1024 * 1024;

const EXT_POR_MIME = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" };
export const ALLOWED_ASSET_MIMES = new Set(Object.keys(EXT_POR_MIME));

// Sube un logo o foto de fondo a academia-assets/{tenant_id}/{slot}.{ext} y
// guarda su URL pública en la columna {slot}_url de academia_config —
// `slot` es "logo" o "bg". `upsert: true` sobrescribe el archivo anterior
// si tenía la misma extensión; si cambia de extensión queda un archivo
// viejo huérfano en el bucket (aceptable, bajo volumen, sin limpieza aquí).
export async function subirAssetConfig(admin, { tenantId, slot, base64Input, mime }) {
  if (!ALLOWED_ASSET_MIMES.has(mime)) {
    return { ok: false, code: "unsupported_mime", motivo: "Solo se aceptan imágenes JPG, PNG o WEBP." };
  }
  const base64 = getBase64FromMaybeDataUrl(base64Input);
  if (!base64) return { ok: false, code: "invalid_base64", motivo: "Archivo inválido." };
  if (approxBase64Bytes(base64) > MAX_ASSET_BYTES) {
    return { ok: false, code: "payload_too_large", motivo: "La imagen supera los 5MB permitidos." };
  }

  const path = `${tenantId}/${slot}.${EXT_POR_MIME[mime]}`;
  const buf = Buffer.from(base64, "base64");
  const { error: uploadErr } = await admin.storage.from(BUCKET).upload(path, buf, { contentType: mime, upsert: true });
  if (uploadErr) return { ok: false, code: "upload_failed", motivo: "No se pudo subir el archivo." };

  const { data: pub } = admin.storage.from(BUCKET).getPublicUrl(path);
  if (!pub?.publicUrl) return { ok: false, code: "public_url_failed", motivo: "No se pudo generar la URL pública." };

  // El path es siempre el mismo ({tenant}/{slot}.{ext}) para que upsert
  // sobrescriba en vez de acumular archivos — pero eso hace que dos subidas
  // seguidas con la misma extensión compartan literalmente la misma URL, y
  // el navegador sirve la imagen vieja desde su caché en vez de pedir la
  // nueva. La query ?v= cambia en cada subida para forzar un recurso
  // distinto, tanto en la aplicación inmediata como en cualquier carga
  // posterior que lea esta misma URL guardada en academia_config.
  const url = `${pub.publicUrl}?v=${Date.now()}`;

  const column = slot === "logo" ? "logo_url" : "bg_url";
  const { error: dbErr } = await admin
    .from("academia_config")
    .upsert({ tenant_id: tenantId, [column]: url }, { onConflict: "tenant_id" });
  if (dbErr) return { ok: false, code: "db_update_failed", motivo: "No se pudo guardar la imagen en la configuración." };

  return { ok: true, url };
}
