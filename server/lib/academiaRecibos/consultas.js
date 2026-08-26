export async function fetchConfig(admin, tenantId) {
  const { data } = await admin
    .from("academia_config")
    .select("nombre_emisor, direccion_emisor, email_emisor, concepto_recibo_plantilla, logo_url, enviar_recibo_al_pagar")
    .eq("tenant_id", tenantId)
    .maybeSingle();
  return data || {};
}

// Familias activas del tenant + sus alumnos activos con el precio_bruto y el
// descuento propio de la tarifa vigente de cada uno — base tanto para GET (listado) como para
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
      .select("alumno_id, precio_bruto, descuento_pct")
      .eq("tenant_id", tenantId)
      .in("alumno_id", alumnoIds)
      .is("fecha_fin", null);
    if (tarifaErr) return { error: tarifaErr };
    tarifaPorAlumno = Object.fromEntries((tarifas || []).map((t) => [t.alumno_id, t]));
  }

  const alumnosPorFamilia = {};
  for (const a of alumnos || []) {
    if (!a.familia_id) continue;
    const item = {
      id: a.id, nombre: a.nombre, curso: a.curso, fecha_alta: a.fecha_alta,
      precio_bruto: Number(tarifaPorAlumno[a.id]?.precio_bruto || 0),
      // Descuento propio de la tarifa del alumno — llega hasta el recibo
      // como línea de descuento (ver descuentoDeTarifa en calculos.js).
      descuento_tarifa_pct: Number(tarifaPorAlumno[a.id]?.descuento_pct || 0),
    };
    (alumnosPorFamilia[a.familia_id] ||= []).push(item);
  }

  const items = (familias || []).map((familia) => ({
    familia,
    alumnosActivos: alumnosPorFamilia[familia.id] || [],
  }));
  return { items };
}

// Set de alumno_id con al menos una sesión ese mes — usado para decidir si
// el botón "Enviar informe" tiene sentido (ver academia.informes.routes.js,
// que rechaza generar un comentario sin sesiones que resumir).
export async function fetchAlumnosConSesionesMes(admin, tenantId, alumnoIds, { mes, anio }) {
  if (!alumnoIds.length) return { conSesiones: new Set() };
  const desde = `${anio}-${String(mes).padStart(2, "0")}-01`;
  const ultimoDia = new Date(Date.UTC(anio, mes, 0)).getUTCDate();
  const hasta = `${anio}-${String(mes).padStart(2, "0")}-${String(ultimoDia).padStart(2, "0")}`;
  const { data, error } = await admin
    .from("academia_sesiones")
    .select("alumno_id")
    .eq("tenant_id", tenantId)
    .eq("tipo", "clase")
    .in("alumno_id", alumnoIds)
    .gte("fecha", desde)
    .lte("fecha", hasta);
  if (error) return { error };
  return { conSesiones: new Set((data || []).map((s) => s.alumno_id)) };
}

// Map alumno_id -> enviado_at (o null) de su informe ese mes — usado junto
// a tiene_sesiones para calcular el estado agregado de la familia (ver
// estadoFamilia.js en el frontend: pendiente hasta que recibo E informes
// de todos los alumnos con sesiones estén enviados).
export async function fetchInformesEnviadosMes(admin, tenantId, alumnoIds, { mes, anio }) {
  if (!alumnoIds.length) return { porAlumno: {} };
  const { data, error } = await admin
    .from("academia_informes")
    .select("alumno_id, enviado_at")
    .eq("tenant_id", tenantId)
    .in("alumno_id", alumnoIds)
    .eq("mes", mes)
    .eq("anio", anio);
  if (error) return { error };
  return { porAlumno: Object.fromEntries((data || []).map((i) => [i.alumno_id, i.enviado_at])) };
}

export async function fetchRecibosDelMes(admin, tenantId, { mes, anio }) {
  const { data, error } = await admin
    .from("academia_recibos")
    .select(
      "id, familia_id, numero_recibo, concepto, estado, total_neto, fecha_envio, descuento_puntual_pct, descuento_puntual_nota"
    )
    .eq("tenant_id", tenantId)
    .eq("mes", mes)
    .eq("anio", anio);
  if (error) return { error };
  return { porFamilia: Object.fromEntries((data || []).map((r) => [r.familia_id, r])) };
}

// familia trae también dni/direccion/codigo_postal/ciudad (no solo
// nombre/email/metodo_pago) — el PDF del recibo (ver
// academiaEnvio/reciboPdfPayload.js) los pinta en "Datos del cliente",
// igual que ya hacía el generador de un solo alumno que sustituye.
export async function fetchReciboCompleto(admin, tenantId, reciboId) {
  const { data: recibo, error: reciboErr } = await admin
    .from("academia_recibos")
    .select("*, familia:academia_familias(id, nombre, email, dni, direccion, codigo_postal, ciudad, metodo_pago)")
    .eq("id", reciboId)
    .eq("tenant_id", tenantId)
    .maybeSingle();
  if (reciboErr) return { error: reciboErr };
  if (!recibo) return { data: null };

  const { data: lineas, error: lineasErr } = await admin
    .from("academia_recibos_lineas")
    .select(
      "id, alumno_id, nombre_alumno, curso_alumno, precio_bruto, descripcion, descuentos_recurrentes"
    )
    .eq("recibo_id", reciboId)
    .order("nombre_alumno", { ascending: true });
  if (lineasErr) return { error: lineasErr };

  return { data: { ...recibo, lineas: lineas || [] } };
}
