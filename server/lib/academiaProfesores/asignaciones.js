// Asignación de alumnos a un profesor de academia — relación simple
// (profesor_id, alumno_id), sin concepto de grupos (ver migración 094 y
// la auditoría de academia_horario que la motivó). `admin` es siempre el
// cliente Supabase con service_role.

export async function fetchAlumnosActivosDelTenant(admin, tenantId) {
  const { data, error } = await admin
    .from("academia_alumnos")
    .select("id, nombre, curso")
    .eq("tenant_id", tenantId)
    .eq("activo", true)
    .order("nombre");
  if (error) return { error };
  return { alumnos: data || [] };
}

export async function fetchAlumnosDeProfesor(admin, tenantId, profesorId) {
  const { data, error } = await admin
    .from("academia_profesor_alumnos")
    .select("alumno_id, alumno:academia_alumnos(id, nombre, curso)")
    .eq("tenant_id", tenantId)
    .eq("profesor_id", profesorId);
  if (error) return { error };
  const alumnos = (data || [])
    .filter((row) => row.alumno)
    .map((row) => ({ id: row.alumno.id, nombre: row.alumno.nombre, curso: row.alumno.curso }));
  return { alumnos };
}

// Solo los ids (sin embeber academia_alumnos) — lo que necesitan las
// vistas de horario/diario del profesor para filtrar sus propias
// consultas (ver resolverAlumnosVisibles.js). Puede devolver un array
// vacío (profesor sin ninguna asignación todavía) — eso es un resultado
// válido, no un error.
export async function fetchAlumnoIdsDeProfesor(admin, tenantId, profesorId) {
  const { data, error } = await admin
    .from("academia_profesor_alumnos")
    .select("alumno_id")
    .eq("tenant_id", tenantId)
    .eq("profesor_id", profesorId);
  if (error) return { error };
  return { alumnoIds: (data || []).map((row) => row.alumno_id) };
}

async function alumnoPerteneceAlTenant(admin, tenantId, alumnoId) {
  const { data } = await admin
    .from("academia_alumnos")
    .select("id")
    .eq("id", alumnoId)
    .eq("tenant_id", tenantId)
    .maybeSingle();
  return Boolean(data);
}

// upsert con onConflict: asignar dos veces al mismo alumno no revienta
// (el selector del drawer puede reenviar el mismo id si el usuario hace
// doble clic antes de que responda el primero).
export async function asignarAlumno(admin, { tenantId, profesorId, alumnoId }) {
  const pertenece = await alumnoPerteneceAlTenant(admin, tenantId, alumnoId);
  if (!pertenece) return { ok: false, code: "alumno_not_found" };

  const { error } = await admin
    .from("academia_profesor_alumnos")
    .upsert({ tenant_id: tenantId, profesor_id: profesorId, alumno_id: alumnoId }, { onConflict: "profesor_id,alumno_id" });
  if (error) return { ok: false, code: "asignar_failed" };
  return { ok: true };
}

export async function quitarAlumno(admin, { tenantId, profesorId, alumnoId }) {
  const { error } = await admin
    .from("academia_profesor_alumnos")
    .delete()
    .eq("tenant_id", tenantId)
    .eq("profesor_id", profesorId)
    .eq("alumno_id", alumnoId);
  if (error) return { ok: false, code: "quitar_failed" };
  return { ok: true };
}
