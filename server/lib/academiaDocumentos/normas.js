import { getBase64FromMaybeDataUrl, approxBase64Bytes } from "../chatValidation.js";

const BUCKET = "academia-documentos";

export const MAX_NORMAS_BYTES = 10 * 1024 * 1024;

export const NORMAS_PDF_MIME = "application/pdf";
export const NORMAS_DOCX_MIME = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

const EXT_POR_MIME = {
  [NORMAS_PDF_MIME]: "pdf",
  [NORMAS_DOCX_MIME]: "docx",
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

// Metadata del documento de normas del tenant (sin descargar el archivo)
// — {ok:false, code:"not_found"} si nunca se subió ninguno, para que la
// ruta lo traduzca a un 404 (ver normas.routes.js). El frontend usa
// `mime` para decidir si puede previsualizarlo embebido (PDF) o debe
// mostrar el aviso de documento legado en Word (ver normasCard.js).
export async function obtenerMetadataNormas(admin, tenantId) {
  const { data: config } = await admin
    .from("academia_config")
    .select("normas_path, normas_mime, normas_updated_at")
    .eq("tenant_id", tenantId)
    .maybeSingle();
  if (!config?.normas_path) {
    return { ok: false, code: "not_found", motivo: "Todavía no se ha subido ningún documento de normas." };
  }
  return { ok: true, mime: config.normas_mime, updatedAt: config.normas_updated_at };
}

// Descarga el documento de normas del tenant tal cual está en Storage,
// para que la ruta lo reenvíe proxied al navegador (ver GET
// /normas/archivo en normas.routes.js) — nunca una URL firmada de
// Storage expuesta directamente al frontend.
export async function descargarArchivoNormas(admin, tenantId) {
  const { data: config } = await admin
    .from("academia_config")
    .select("normas_path, normas_mime")
    .eq("tenant_id", tenantId)
    .maybeSingle();
  if (!config?.normas_path) {
    return { ok: false, code: "not_found", motivo: "Todavía no se ha subido ningún documento de normas." };
  }
  try {
    const { data, error } = await admin.storage.from(BUCKET).download(config.normas_path);
    if (error || !data) return { ok: false, code: "download_failed", motivo: "No se pudo descargar el documento." };
    const buffer = Buffer.from(await data.arrayBuffer());
    return { ok: true, buffer, mime: config.normas_mime };
  } catch (err) {
    return { ok: false, code: "download_failed", motivo: "No se pudo descargar el documento.", error: err };
  }
}
