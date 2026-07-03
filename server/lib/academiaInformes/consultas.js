// Primer y último día (YYYY-MM-DD) de un mes/año — usado tanto para la
// tabla de días del informe como para acotar sesiones/notas de examen.
export function monthBounds(mes, anio) {
  const desde = `${anio}-${String(mes).padStart(2, "0")}-01`;
  const ultimoDia = new Date(Date.UTC(anio, mes, 0)).getUTCDate();
  const hasta = `${anio}-${String(mes).padStart(2, "0")}-${String(ultimoDia).padStart(2, "0")}`;
  return { desde, hasta };
}

export async function fetchAlumnoConFamilia(admin, tenantId, alumnoId) {
  const { data, error } = await admin
    .from("academia_alumnos")
    .select(
      "id, nombre, curso, familia_id, " +
        "familia:academia_familias(id, nombre, email, dni, direccion, ciudad, codigo_postal, metodo_pago)"
    )
    .eq("id", alumnoId)
    .eq("tenant_id", tenantId)
    .maybeSingle();
  if (error) return { error };
  return { alumno: data };
}

export async function fetchConfigInforme(admin, tenantId) {
  const { data } = await admin
    .from("academia_config")
    .select("nombre_emisor, dni_emisor, direccion_emisor, ciudad_emisor, cp_emisor, telefono_emisor, email_emisor, logo_url, texto_exencion_iva")
    .eq("tenant_id", tenantId)
    .maybeSingle();
  return data || {};
}

export async function fetchNotasExamenMes(admin, tenantId, alumnoId, { mes, anio }) {
  const { desde, hasta } = monthBounds(mes, anio);
  const { data, error } = await admin
    .from("academia_notas_examen")
    .select("asignatura, nota, fecha")
    .eq("tenant_id", tenantId)
    .eq("alumno_id", alumnoId)
    .gte("fecha", desde)
    .lte("fecha", hasta)
    .order("fecha", { ascending: true });
  if (error) return { error };
  return { notas: data || [] };
}

export async function fetchInformeExistente(admin, tenantId, alumnoId, { mes, anio }) {
  const { data, error } = await admin
    .from("academia_informes")
    .select("id, comentario, enviado_at")
    .eq("tenant_id", tenantId)
    .eq("alumno_id", alumnoId)
    .eq("mes", mes)
    .eq("anio", anio)
    .maybeSingle();
  if (error) return { error };
  return { informe: data };
}

// El recibo es por familia (academia_recibos), no por alumno — cada hermano
// tiene su propia línea dentro del recibo de la familia (academia_recibos_lineas).
export async function fetchReciboLineaAlumno(admin, tenantId, { alumnoId, familiaId, mes, anio }) {
  if (!familiaId) return { linea: null, numeroRecibo: null };

  const { data: recibo, error: reciboErr } = await admin
    .from("academia_recibos")
    .select("id, numero_recibo")
    .eq("tenant_id", tenantId)
    .eq("familia_id", familiaId)
    .eq("mes", mes)
    .eq("anio", anio)
    .maybeSingle();
  if (reciboErr) return { error: reciboErr };
  if (!recibo) return { linea: null, numeroRecibo: null };

  const { data: linea, error: lineaErr } = await admin
    .from("academia_recibos_lineas")
    .select("precio_bruto, descuentos_recurrentes")
    .eq("recibo_id", recibo.id)
    .eq("alumno_id", alumnoId)
    .maybeSingle();
  if (lineaErr) return { error: lineaErr };
  return { linea, numeroRecibo: recibo.numero_recibo };
}
