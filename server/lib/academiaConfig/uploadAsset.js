import { subirArchivoAcademiaAssets } from "../academiaStorage/subirArchivo.js";

export const MAX_ASSET_BYTES = 5 * 1024 * 1024;

const EXT_POR_MIME = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" };
export const ALLOWED_ASSET_MIMES = new Set(Object.keys(EXT_POR_MIME));

// Sube un logo o foto de fondo a academia-assets/{tenant_id}/{slot}.{ext} y
// guarda su URL pública en la columna {slot}_url de academia_config —
// `slot` es "logo" o "bg". El path es siempre el mismo, así que una
// segunda subida con la misma extensión sobrescribe en vez de acumular
// archivos; si cambia de extensión queda un archivo viejo huérfano en el
// bucket (aceptable, bajo volumen, sin limpieza aquí).
export async function subirAssetConfig(admin, { tenantId, slot, base64Input, mime }) {
  if (!ALLOWED_ASSET_MIMES.has(mime)) {
    return { ok: false, code: "unsupported_mime", motivo: "Solo se aceptan imágenes JPG, PNG o WEBP." };
  }

  const path = `${tenantId}/${slot}.${EXT_POR_MIME[mime]}`;
  const subida = await subirArchivoAcademiaAssets(admin, { path, base64Input, mime, maxBytes: MAX_ASSET_BYTES });
  if (!subida.ok) return subida;

  const column = slot === "logo" ? "logo_url" : "bg_url";
  const { error: dbErr } = await admin
    .from("academia_config")
    .upsert({ tenant_id: tenantId, [column]: subida.url }, { onConflict: "tenant_id" });
  if (dbErr) return { ok: false, code: "db_update_failed", motivo: "No se pudo guardar la imagen en la configuración." };

  return { ok: true, url: subida.url };
}
