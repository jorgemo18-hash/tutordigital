// Descuentos recurrentes: tipos configurados por tenant (academia_descuentos_tipo)
// y su asignación por alumno (academia_alumno_descuentos). Esta última tabla
// NO tiene columna tenant_id propia — el tenant se resuelve siempre a través
// del alumno (academia_alumnos.tenant_id) o del tipo (academia_descuentos_tipo.
// tenant_id), así que toda query aquí valida esa pertenencia explícitamente
// antes de tocar la tabla — de lo contrario alumnoId/descuentoTipoId (ambos
// llegan como parámetro de ruta) permitirían leer o vincular datos de otro
// tenant (bug de seguridad real, corregido 2026-07-05).

async function alumnoPerteneceATenant(admin, alumnoId, tenantId) {
  const { data, error } = await admin
    .from("academia_alumnos")
    .select("id")
    .eq("id", alumnoId)
    .eq("tenant_id", tenantId)
    .maybeSingle();
  if (error) return { ok: false, error };
  return { ok: true, pertenece: !!data };
}

async function descuentoTiposPertenecenATenant(admin, descuentoTipoIds, tenantId) {
  if (!descuentoTipoIds.length) return { ok: true, pertenecen: true };
  const { data, error } = await admin
    .from("academia_descuentos_tipo")
    .select("id")
    .in("id", descuentoTipoIds)
    .eq("tenant_id", tenantId);
  if (error) return { ok: false, error };
  return { ok: true, pertenecen: (data || []).length === descuentoTipoIds.length };
}

// Todos los tipos del tenant + si este alumno los tiene asignados y, si sí,
// activos — para el checklist "DESCUENTOS RECURRENTES" del drawer de alumno.
export async function fetchDescuentosTipoConAsignacion(admin, tenantId, alumnoId) {
  const alumnoCheck = await alumnoPerteneceATenant(admin, alumnoId, tenantId);
  if (!alumnoCheck.ok) return { error: alumnoCheck.error };
  if (!alumnoCheck.pertenece) return { forbidden: true };

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
// constraint (alumno_id, descuento_tipo_id) de la tabla. Valida que el
// alumno Y cada tipo de descuento pertenezcan al tenant antes de escribir —
// sin esto, un admin podía vincular un alumno de otro tenant a un descuento
// propio (o viceversa), contaminando el cálculo de recibos del tenant ajeno.
export async function upsertAlumnoDescuentos(admin, tenantId, alumnoId, asignaciones) {
  if (!asignaciones?.length) return { error: null };

  const alumnoCheck = await alumnoPerteneceATenant(admin, alumnoId, tenantId);
  if (!alumnoCheck.ok) return { error: alumnoCheck.error };
  if (!alumnoCheck.pertenece) return { forbidden: true };

  const tipoIds = asignaciones.map((a) => a.descuento_tipo_id);
  const tipoCheck = await descuentoTiposPertenecenATenant(admin, tipoIds, tenantId);
  if (!tipoCheck.ok) return { error: tipoCheck.error };
  if (!tipoCheck.pertenecen) return { forbidden: true };

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
// Devuelve un mapa alumno_id -> [{concepto, porcentaje, acumulable, intervalo}].
// El filtro de tenant va sobre el tipo embebido (!inner obliga el join) —
// alumnoIds ya llega acotado al tenant desde el llamador, esto es una
// segunda capa de defensa, no la única.
export async function fetchDescuentosActivosPorAlumno(admin, tenantId, alumnoIds) {
  if (!alumnoIds?.length) return { porAlumno: {} };
  const { data, error } = await admin
    .from("academia_alumno_descuentos")
    .select("alumno_id, descuento_tipo:academia_descuentos_tipo!inner(concepto, porcentaje, acumulable, intervalo, tenant_id)")
    .eq("activo", true)
    .eq("descuento_tipo.tenant_id", tenantId)
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
export async function contarAsignacionesActivas(admin, tenantId, descuentoTipoId) {
  const tipoCheck = await descuentoTiposPertenecenATenant(admin, [descuentoTipoId], tenantId);
  if (!tipoCheck.ok) return { count: 0, error: tipoCheck.error };
  if (!tipoCheck.pertenecen) return { count: 0, forbidden: true };

  const { count, error } = await admin
    .from("academia_alumno_descuentos")
    .select("id", { count: "exact", head: true })
    .eq("descuento_tipo_id", descuentoTipoId)
    .eq("activo", true);
  return { count: count || 0, error };
}
