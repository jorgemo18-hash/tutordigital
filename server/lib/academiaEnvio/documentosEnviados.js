import { BUCKET_PRIVADO } from "../academiaStorage/archivoPrivado.js";

// EL PDF EXACTO DE CADA ENVÍO (migración 147). Se guarda después de que el
// correo haya salido y NUNCA puede romper el envío: si algo falla aquí se
// devuelve el error para el log y ya está (misma regla que registroEnvio.js).
//
// Nada se sobrescribe: cada envío deja sus PDF con su instante en la ruta, y
// la pantalla enseña el último.

function rutaDelDocumento({ tenantId, familiaId, mes, anio, instante, nombreArchivo }) {
  const mm = String(mes).padStart(2, "0");
  return `${tenantId}/envios/${anio}-${mm}/${familiaId || "sin-familia"}/${instante}-${nombreArchivo}`;
}

// `documentos`: [{ tipo, buffer, nombreArchivo, mes, anio, reciboId?, alumnoId? }]
export async function guardarDocumentosEnviados(admin, {
  tenantId, envioId = null, familiaId = null, destinatario = null, documentos = [], ahora = new Date(),
}) {
  const instante = ahora.toISOString().replace(/[:.]/g, "-");
  const errores = [];
  for (const doc of documentos) {
    const path = rutaDelDocumento({ tenantId, familiaId, mes: doc.mes, anio: doc.anio, instante, nombreArchivo: doc.nombreArchivo });
    const { error: subidaErr } = await admin.storage.from(BUCKET_PRIVADO).upload(path, doc.buffer, { contentType: "application/pdf", upsert: false });
    if (subidaErr) { errores.push({ nombre: doc.nombreArchivo, error: subidaErr }); continue; }
    const { error: filaErr } = await admin.from("academia_documentos_enviados").insert({
      tenant_id: tenantId,
      envio_id: envioId,
      familia_id: familiaId,
      alumno_id: doc.alumnoId || null,
      recibo_id: doc.reciboId || null,
      tipo: doc.tipo,
      mes: doc.mes,
      anio: doc.anio,
      storage_path: path,
      nombre_archivo: doc.nombreArchivo,
      destinatario,
      enviado_at: ahora.toISOString(),
    });
    if (filaErr) errores.push({ nombre: doc.nombreArchivo, error: filaErr });
  }
  return { guardados: documentos.length - errores.length, errores };
}

// Los enviados de una familia, de un tipo y un mes (del documento), del más
// reciente al más antiguo. `alumnoId` acota los informes a un alumno.
export async function fetchDocumentosEnviados(admin, tenantId, { familiaId, tipo, mes, anio, alumnoId = null }) {
  let query = admin
    .from("academia_documentos_enviados")
    .select("id, tipo, mes, anio, alumno_id, nombre_archivo, destinatario, enviado_at")
    .eq("tenant_id", tenantId)
    .eq("familia_id", familiaId)
    .eq("tipo", tipo)
    .eq("mes", mes)
    .eq("anio", anio);
  if (alumnoId) query = query.eq("alumno_id", alumnoId);
  const { data, error } = await query.order("enviado_at", { ascending: false });
  if (error) return { error };
  return { documentos: data || [] };
}

export async function fetchDocumentoEnviado(admin, tenantId, id) {
  const { data, error } = await admin
    .from("academia_documentos_enviados")
    .select("id, storage_path, nombre_archivo")
    .eq("tenant_id", tenantId)
    .eq("id", id)
    .maybeSingle();
  if (error) return { error };
  return { documento: data || null };
}

// DERECHO DE SUPRESIÓN: al eliminar definitivamente a un alumno se van con él
// los PDF de SUS INFORMES enviados (el aviso de borrado ya dice "sus
// informes"). Los recibos se conservan, como las filas de recibo: son
// documentos contables del centro (ver mensajeEliminarAlumno.js).
//
// Tiene que ejecutarse ANTES de borrar al alumno: después, `alumno_id` ya es
// null (ON DELETE SET NULL) y no habría forma de saber cuáles eran suyos.
// Borra las filas y devuelve las rutas; los archivos los quita quien llama
// cuando el alumno ya no existe, igual que la ficha escaneada.
export async function quitarInformesEnviadosDelAlumno(admin, tenantId, alumnoId) {
  const { data, error } = await admin
    .from("academia_documentos_enviados")
    .select("id, storage_path")
    .eq("tenant_id", tenantId)
    .eq("alumno_id", alumnoId)
    .eq("tipo", "informe");
  if (error) return { error };
  const filas = data || [];
  if (filas.length) {
    const { error: delErr } = await admin
      .from("academia_documentos_enviados")
      .delete()
      .in("id", filas.map((f) => f.id));
    if (delErr) return { error: delErr };
  }
  return { rutas: filas.map((f) => f.storage_path) };
}
