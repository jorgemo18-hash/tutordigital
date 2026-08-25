// Borradores de inscripción pendientes de revisar: alumnos creados desde el
// OCR de la ficha en papel y guardados como borrador (activo = false), que
// todavía no se han activado. Los archivados también tienen activo = false,
// pero SÍ tienen fecha_baja, así que quedan fuera por el .is("fecha_baja", null).
//
// Extraído de la ruta para poder probar con un cliente falso qué se consulta
// exactamente: hasta la migración 103 este listado sumaba además los alumnos
// ACTIVOS con cuenta de tutor sin estrenar, y eso hacía que el banner ámbar
// de "inscripciones pendientes de revisar" contara a toda la academia
// mientras el tutor no estuviera repartido. Un alumno matriculado no es una
// inscripción pendiente.
export const PENDIENTES_COLUMNS =
  "id, nombre, curso, nivel, fecha_alta, created_at, familia:academia_familias(id, nombre, email)";

export async function fetchInscripcionesPendientes(admin, tenantId) {
  const { data, error } = await admin
    .from("academia_alumnos")
    .select(PENDIENTES_COLUMNS)
    .eq("tenant_id", tenantId)
    .eq("activo", false)
    .is("fecha_baja", null)
    .order("created_at", { ascending: false });

  if (error) return { error };
  return { alumnos: data || [] };
}
