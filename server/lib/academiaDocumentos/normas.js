import { getBase64FromMaybeDataUrl, approxBase64Bytes } from "../chatValidation.js";

const BUCKET = "academia-documentos";
const SIGNED_URL_TTL = 60 * 60; // 60 minutos, en segundos

export const MAX_NORMAS_BYTES = 10 * 1024 * 1024;

const EXT_POR_MIME = {
  "application/pdf": "pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "docx",
};
export const ALLOWED_NORMAS_MIMES = new Set(Object.keys(EXT_POR_MIME));

// Sube (o reemplaza) el documento de normas del tenant en
// academia-documentos/{tenant_id}/normas.{ext} y guarda su ruta/mime en
// academia_config. Si el documento anterior tenía otra extensión (p.ej. un
// PDF reemplazado por un DOCX) el archivo viejo se borra explícitamente —
// con upsert:true en la misma ruta no bastaría, porque la ruta nueva tiene
// otro nombre y el viejo quedaría huérfano en el bucket.
export async function subirNormas(admin, tenantId, { base64Input, mime }) {
  if (!ALLOWED_NORMAS_MIMES.has(mime)) {
    return { ok: false, code: "unsupported_mime", motivo: "Solo se aceptan documentos PDF o DOCX." };
  }
  const base64 = getBase64FromMaybeDataUrl(base64Input);
  if (!base64) return { ok: false, code: "invalid_base64", motivo: "Archivo inválido." };
  if (approxBase64Bytes(base64) > MAX_NORMAS_BYTES) {
    return { ok: false, code: "payload_too_large", motivo: `El archivo supera los ${Math.round(MAX_NORMAS_BYTES / (1024 * 1024))}MB permitidos.` };
  }

  const { data: config } = await admin
    .from("academia_config")
    .select("normas_path")
    .eq("tenant_id", tenantId)
    .maybeSingle();

  const path = `${tenantId}/normas.${EXT_POR_MIME[mime]}`;
  if (config?.normas_path && config.normas_path !== path) {
    await admin.storage.from(BUCKET).remove([config.normas_path]).catch(() => {});
  }

  const buf = Buffer.from(base64, "base64");
  const { error: uploadErr } = await admin.storage.from(BUCKET).upload(path, buf, { contentType: mime, upsert: true });
  if (uploadErr) return { ok: false, code: "upload_failed", motivo: "No se pudo subir el archivo." };

  const { error: dbErr } = await admin
    .from("academia_config")
    .upsert(
      { tenant_id: tenantId, normas_path: path, normas_mime: mime, normas_updated_at: new Date().toISOString() },
      { onConflict: "tenant_id" }
    );
  if (dbErr) return { ok: false, code: "db_update_failed", motivo: "El archivo se subió pero no se pudo guardar la referencia." };

  return { ok: true };
}

// URL firmada de descarga del documento de normas del tenant —
// {ok:false, code:"not_found"} si nunca se subió ninguno, para que la
// ruta lo traduzca a un 404 (ver normas.routes.js).
export async function obtenerUrlNormas(admin, tenantId) {
  const { data: config } = await admin
    .from("academia_config")
    .select("normas_path, normas_mime, normas_updated_at")
    .eq("tenant_id", tenantId)
    .maybeSingle();
  if (!config?.normas_path) {
    return { ok: false, code: "not_found", motivo: "Todavía no se ha subido ningún documento de normas." };
  }

  const { data: signed, error } = await admin.storage
    .from(BUCKET)
    .createSignedUrl(config.normas_path, SIGNED_URL_TTL);
  if (error || !signed?.signedUrl) {
    return { ok: false, code: "signed_url_failed", motivo: "No se pudo generar la URL de descarga." };
  }

  return { ok: true, url: signed.signedUrl, mime: config.normas_mime, updatedAt: config.normas_updated_at };
}
