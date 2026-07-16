// Caché de la hoja de inscripción generada — bucket privado, acceso solo
// vía service role desde el backend (el frontend nunca recibe una URL
// directa de Storage, ver hojaInscripcion.routes.js, que hace de proxy
// igual que antes de tener caché). Ruta: {tenant_id}/hoja-inscripcion-{hash}.pdf
// — el hash vive en el nombre del archivo, no hay columna nueva en
// ninguna tabla (ver hashHojaInscripcion.js).
const BUCKET = "documentos-generados";

function rutaCache(tenantId, hash) {
  return `${tenantId}/hoja-inscripcion-${hash}.pdf`;
}

// {ok:false} en cualquier fallo (no existe, o Storage no responde) — el
// llamador degrada a generar en vivo, nunca es un error que deba llegar
// al usuario (ver hojaInscripcion.routes.js).
export async function leerCacheHojaInscripcion(admin, tenantId, hash) {
  try {
    const { data, error } = await admin.storage.from(BUCKET).download(rutaCache(tenantId, hash));
    if (error || !data) return { ok: false };
    const buffer = Buffer.from(await data.arrayBuffer());
    return { ok: true, buffer };
  } catch (err) {
    return { ok: false, error: err };
  }
}

// Sube el PDF recién generado a su ruta con hash y limpia versiones
// anteriores de este tenant (cualquier otro hoja-inscripcion-*.pdf del
// mismo tenant_id — el hash cambia con la config, así que sin esta
// limpieza cada cambio dejaría un archivo huérfano para siempre). La
// limpieza no es crítica: si falla, el PDF ya se subió y se sirve igual;
// solo quedan archivos viejos ocupando espacio, no rompen nada.
export async function guardarCacheHojaInscripcion(admin, tenantId, hash, buffer) {
  const path = rutaCache(tenantId, hash);
  try {
    const { error } = await admin.storage.from(BUCKET).upload(path, buffer, {
      contentType: "application/pdf",
      upsert: true,
    });
    if (error) return { ok: false, error };
  } catch (err) {
    return { ok: false, error: err };
  }

  try {
    const { data: existentes } = await admin.storage.from(BUCKET).list(tenantId, { search: "hoja-inscripcion-" });
    const aBorrar = (existentes || [])
      .map((f) => `${tenantId}/${f.name}`)
      .filter((p) => p !== path);
    if (aBorrar.length) await admin.storage.from(BUCKET).remove(aBorrar);
  } catch {
    // No crítico — ver comentario de arriba.
  }

  return { ok: true };
}
