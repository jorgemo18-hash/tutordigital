export async function fetchConfig(admin, tenantId) {
  const { data } = await admin
    .from("academia_config")
    .select("nombre_emisor, direccion_emisor, email_emisor, concepto_recibo_plantilla, texto_exencion_iva")
    .eq("tenant_id", tenantId)
    .maybeSingle();
  return data || {};
}

// Familias activas del tenant + sus alumnos activos con el precio_bruto de
// la tarifa vigente de cada uno — base tanto para GET (listado) como para
// generar/regenerar recibos (cálculo de totales).
export async function fetchFamiliasConAlumnos(admin, tenantId) {
  const [{ data: familias, error: famErr }, { data: alumnos, error: alErr }] = await Promise.all([
    admin
      .from("academia_familias")
      .select("id, nombre, email, metodo_pago")
      .eq("tenant_id", tenantId)
      .eq("activa", true)
      .order("nombre", { ascending: true }),
    admin
      .from("academia_alumnos")
      .select("id, nombre, curso, familia_id, fecha_alta")
      .eq("tenant_id", tenantId)
      .eq("activo", true),
  ]);
  if (famErr || alErr) return { error: famErr || alErr };

  const alumnoIds = (alumnos || []).map((a) => a.id);
  let tarifaPorAlumno = {};
  if (alumnoIds.length) {
    const { data: tarifas, error: tarifaErr } = await admin
      .from("academia_tarifas")
      .select("alumno_id, precio_bruto")
      .eq("tenant_id", tenantId)
      .in("alumno_id", alumnoIds)
      .is("fecha_fin", null);
    if (tarifaErr) return { error: tarifaErr };
    tarifaPorAlumno = Object.fromEntries((tarifas || []).map((t) => [t.alumno_id, t.precio_bruto]));
  }

  const alumnosPorFamilia = {};
  for (const a of alumnos || []) {
    if (!a.familia_id) continue;
    const item = {
      id: a.id, nombre: a.nombre, curso: a.curso, fecha_alta: a.fecha_alta,
      precio_bruto: Number(tarifaPorAlumno[a.id] || 0),
    };
    (alumnosPorFamilia[a.familia_id] ||= []).push(item);
  }

  const items = (familias || []).map((familia) => ({
    familia,
    alumnosActivos: alumnosPorFamilia[familia.id] || [],
  }));
  return { items };
}

export async function fetchRecibosDelMes(admin, tenantId, { mes, anio }) {
  const { data, error } = await admin
    .from("academia_recibos")
    .select("id, familia_id, numero_recibo, concepto, estado, total_neto, fecha_envio")
    .eq("tenant_id", tenantId)
    .eq("mes", mes)
    .eq("anio", anio);
  if (error) return { error };
  return { porFamilia: Object.fromEntries((data || []).map((r) => [r.familia_id, r])) };
}

export async function fetchReciboCompleto(admin, tenantId, reciboId) {
  const { data: recibo, error: reciboErr } = await admin
    .from("academia_recibos")
    .select("*, familia:academia_familias(id, nombre, email, metodo_pago)")
    .eq("id", reciboId)
    .eq("tenant_id", tenantId)
    .maybeSingle();
  if (reciboErr) return { error: reciboErr };
  if (!recibo) return { data: null };

  const { data: lineas, error: lineasErr } = await admin
    .from("academia_recibos_lineas")
    .select(
      "id, alumno_id, nombre_alumno, curso_alumno, precio_bruto, descripcion, " +
      "descuento_recurrente_pct, descuento_recurrente_concepto"
    )
    .eq("recibo_id", reciboId)
    .order("nombre_alumno", { ascending: true });
  if (lineasErr) return { error: lineasErr };

  return { data: { ...recibo, lineas: lineas || [] } };
}
