// Deriva si un registro (sesión/nota) se hizo por asignación directa o
// vía una sustitución — sin guardar ningún dato nuevo en el registro: se
// calcula a partir de profesor_id (ya guardado en la fila) + el estado de
// academia_profesor_alumnos/academia_sustituciones EN LA FECHA del
// registro, no el estado actual. Por eso mira TODAS las sustituciones
// (revocadas incluidas): una revocación cierra el acceso a partir de ese
// momento, pero no debe borrar la explicación de lo que ya se hizo
// legítimamente mientras estuvo activa.
export async function derivarSustitucionParaRegistro(admin, { tenantId, profesorId, alumnoId, fecha }) {
  if (!profesorId) return null;

  const { data: asignacionDirecta } = await admin
    .from("academia_profesor_alumnos")
    .select("id")
    .eq("tenant_id", tenantId)
    .eq("profesor_id", profesorId)
    .eq("alumno_id", alumnoId)
    .maybeSingle();
  if (asignacionDirecta) return null;

  const { data: sustitucion } = await admin
    .from("academia_sustituciones")
    .select("profesor_sustituido_id")
    .eq("tenant_id", tenantId)
    .eq("profesor_sustituto_id", profesorId)
    .lte("fecha_inicio", fecha)
    .gte("fecha_fin", fecha)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!sustitucion) return null;

  const { data: sustituido } = await admin
    .from("teacher_profiles")
    .select("display_name")
    .eq("id", sustitucion.profesor_sustituido_id)
    .maybeSingle();

  return {
    profesor_sustituido_id: sustitucion.profesor_sustituido_id,
    sustituido_nombre: sustituido?.display_name || null,
  };
}
