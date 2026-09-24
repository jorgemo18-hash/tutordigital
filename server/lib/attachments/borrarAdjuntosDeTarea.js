// BORRAR UNA TAREA BORRA SUS ARCHIVOS, NO SOLO SUS FILAS.
//
// Al borrar una tarea se borraban las filas de `attachments`, pero nunca el
// archivo del bucket. Y los caminos que borraban tareas por otro lado ni
// siquiera las filas. Resultado, visto en producción el 24/09/2026: de 87
// archivos en `task-attachments`, 34 tenían fila de una tarea que ya no
// existe y 51 no tenían fila. Enunciados y fotos de cuadernos de alumnos
// menores acumulándose sin que nada los borre.
//
// Orden: primero los archivos (hace falta la fila para saber su ruta),
// después las filas. Si Storage falla, se sigue y se avisa: la tarea se
// borra igual, y lo que quede lo encuentra el barrido
// (scripts/limpiar-adjuntos-huerfanos.mjs). Un fallo de Storage no puede
// dejar al profesor sin poder borrar su tarea.
export const BUCKET = "task-attachments";

export async function borrarAdjuntosDeTarea(admin, { tenantId, taskId }) {
  const [adj, ses] = await Promise.all([
    admin.from("attachments").select("storage_path")
      .eq("tenant_id", tenantId).eq("owner_type", "task").eq("owner_id", taskId),
    admin.from("session_attachments").select("storage_path")
      .eq("tenant_id", tenantId).eq("task_id", taskId),
  ]);
  if (adj.error || ses.error) return { ok: false, error: adj.error || ses.error };

  const rutas = [...(adj.data || []), ...(ses.data || [])].map((r) => r.storage_path).filter(Boolean);
  let avisoStorage = null;
  if (rutas.length) {
    const { error } = await admin.storage.from(BUCKET).remove(rutas);
    if (error) avisoStorage = error;
  }

  const { error: filasErr } = await admin.from("attachments").delete()
    .eq("tenant_id", tenantId).eq("owner_type", "task").eq("owner_id", taskId);
  if (filasErr) return { ok: false, error: filasErr };
  return { ok: true, archivos: rutas.length, avisoStorage };
}
