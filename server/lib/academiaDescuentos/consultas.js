// Descuentos recurrentes: tipos configurados por tenant (academia_descuentos_tipo)
// y su asignación por alumno (academia_alumno_descuentos, sin tenant_id
// propio — el tenant se resuelve siempre a través del alumno o del tipo).

// Todos los tipos del tenant + si este alumno los tiene asignados y, si sí,
// activos — para el checklist "DESCUENTOS RECURRENTES" del drawer de alumno.
export async function fetchDescuentosTipoConAsignacion(admin, tenantId, alumnoId) {
  const [{ data: tipos, error: tiposErr }, { data: asignados, error: asigErr }] = await Promise.all([
    admin
      .from("academia_descuentos_tipo")
      .select("id, concepto, porcentaje, acumulable, intervalo")
      .eq("tenant_id", tenantId)
      .order("concepto", { ascending: true }),
    admin
      .from("academia_alumno_descuentos")
      .select("descuento_tipo_id, activo")
      .eq("alumno_id", alumnoId),
  ]);
  if (tiposErr || asigErr) return { error: tiposErr || asigErr };

  const asignacionPorTipo = Object.fromEntries((asignados || []).map((a) => [a.descuento_tipo_id, a.activo]));
  const items = (tipos || []).map((t) => ({
    ...t,
    asignado: t.id in asignacionPorTipo,
    activo: asignacionPorTipo[t.id] ?? false,
  }));
  return { items };
}

// `asignaciones`: [{descuento_tipo_id, activo}] — upsert por la unique
// constraint (alumno_id, descuento_tipo_id) de la tabla.
export async function upsertAlumnoDescuentos(admin, alumnoId, asignaciones) {
  if (!asignaciones?.length) return { error: null };
  const rows = asignaciones.map((a) => ({
    alumno_id: alumnoId,
    descuento_tipo_id: a.descuento_tipo_id,
    activo: a.activo,
  }));
  const { error } = await admin
    .from("academia_alumno_descuentos")
    .upsert(rows, { onConflict: "alumno_id,descuento_tipo_id" });
  return { error };
}

// Descuentos recurrentes ACTIVOS de varios alumnos a la vez, con los datos
// de su tipo embebidos — usado al generar recibos (ver generarRecibo.js).
// Devuelve un mapa alumno_id -> [{porcentaje, acumulable, intervalo}].
export async function fetchDescuentosActivosPorAlumno(admin, alumnoIds) {
  if (!alumnoIds?.length) return { porAlumno: {} };
  const { data, error } = await admin
    .from("academia_alumno_descuentos")
    .select("alumno_id, descuento_tipo:academia_descuentos_tipo(porcentaje, acumulable, intervalo)")
    .eq("activo", true)
    .in("alumno_id", alumnoIds);
  if (error) return { error };

  const porAlumno = {};
  for (const row of data || []) {
    if (!row.descuento_tipo) continue;
    (porAlumno[row.alumno_id] ||= []).push(row.descuento_tipo);
  }
  return { porAlumno };
}

// Para el DELETE de un tipo: ¿algún alumno lo tiene activo todavía?
export async function contarAsignacionesActivas(admin, descuentoTipoId) {
  const { count, error } = await admin
    .from("academia_alumno_descuentos")
    .select("id", { count: "exact", head: true })
    .eq("descuento_tipo_id", descuentoTipoId)
    .eq("activo", true);
  return { count: count || 0, error };
}
