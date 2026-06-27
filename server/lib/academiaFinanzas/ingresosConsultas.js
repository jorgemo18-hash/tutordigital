import { mesesDelCurso, claveMesAnio } from "./cursoAcademico.js";

// KPIs de la vista general de Ingresos para un mes concreto.
export async function fetchResumenIngresos(admin, tenantId, { mes, anio }) {
  const { data: recibosMes, error: errMes } = await admin
    .from("academia_recibos")
    .select("familia_id, estado, total_neto")
    .eq("tenant_id", tenantId)
    .eq("mes", mes)
    .eq("anio", anio);
  if (errMes) return { error: errMes };

  const cobrado_mes = (recibosMes || []).filter((r) => r.estado === "pagado").reduce((s, r) => s + Number(r.total_neto), 0);
  const pendiente = (recibosMes || []).filter((r) => r.estado !== "pagado").reduce((s, r) => s + Number(r.total_neto), 0);
  const total_familias = new Set((recibosMes || []).map((r) => r.familia_id)).size;
  const familiasNoAlDia = new Set((recibosMes || []).filter((r) => r.estado !== "pagado").map((r) => r.familia_id));
  const familias_al_dia = total_familias - familiasNoAlDia.size;

  const curso = mesesDelCurso(mes, anio);
  const { data: recibosCurso, error: errCurso } = await admin
    .from("academia_recibos")
    .select("mes, anio, total_neto, estado")
    .eq("tenant_id", tenantId)
    .eq("estado", "pagado")
    .in("anio", [...new Set(curso.map((c) => c.anio))]);
  if (errCurso) return { error: errCurso };

  const clavesCurso = new Set(curso.map((c) => claveMesAnio(c.mes, c.anio)));
  const total_curso = (recibosCurso || [])
    .filter((r) => clavesCurso.has(claveMesAnio(r.mes, r.anio)))
    .reduce((s, r) => s + Number(r.total_neto), 0);

  return {
    resumen: {
      cobrado_mes: Math.round(cobrado_mes * 100) / 100,
      familias_al_dia,
      total_familias,
      pendiente: Math.round(pendiente * 100) / 100,
      total_curso: Math.round(total_curso * 100) / 100,
    },
  };
}

// Tabla "Cobros mensuales por alumno": una fila por alumno activo, una
// columna por cada mes del curso que contiene (mes, anio), con el estado
// de su recibo ese mes (a través de academia_recibos_lineas, que es la
// única tabla que liga alumno_id con un recibo concreto — los recibos son
// por familia, no por alumno).
export async function fetchGridIngresos(admin, tenantId, { mes, anio }) {
  const curso = mesesDelCurso(mes, anio);
  const aniosCurso = [...new Set(curso.map((c) => c.anio))];

  const { data: alumnos, error: errAlumnos } = await admin
    .from("academia_alumnos")
    .select("id, nombre, familia_id, familia:academia_familias(nombre)")
    .eq("tenant_id", tenantId)
    .eq("activo", true)
    .order("nombre", { ascending: true });
  if (errAlumnos) return { error: errAlumnos };

  const alumnoIds = (alumnos || []).map((a) => a.id);
  const [{ data: tarifas, error: errTarifas }, { data: recibos, error: errRecibos }] = await Promise.all([
    alumnoIds.length
      ? admin.from("academia_tarifas").select("alumno_id, precio_neto").eq("tenant_id", tenantId).in("alumno_id", alumnoIds).is("fecha_fin", null)
      : Promise.resolve({ data: [] }),
    admin.from("academia_recibos").select("id, mes, anio, estado").eq("tenant_id", tenantId).in("anio", aniosCurso),
  ]);
  if (errTarifas || errRecibos) return { error: errTarifas || errRecibos };

  const recibosPorId = Object.fromEntries((recibos || []).map((r) => [r.id, r]));
  const reciboIdsCurso = (recibos || [])
    .filter((r) => curso.some((c) => c.mes === r.mes && c.anio === r.anio))
    .map((r) => r.id);

  const { data: lineas, error: errLineas } = reciboIdsCurso.length
    ? await admin.from("academia_recibos_lineas").select("alumno_id, recibo_id").in("recibo_id", reciboIdsCurso)
    : { data: [] };
  if (errLineas) return { error: errLineas };

  // alumno_id -> { "anio-mes": {recibo_id, estado} } — el id hace falta
  // para que el frontend pueda llamar a marcar-pagado/pendiente sobre ESE
  // recibo concreto cuando el admin toca el checkbox de esa celda.
  const reciboPorAlumnoYMes = {};
  for (const linea of lineas || []) {
    const recibo = recibosPorId[linea.recibo_id];
    if (!recibo) continue;
    (reciboPorAlumnoYMes[linea.alumno_id] ||= {})[claveMesAnio(recibo.mes, recibo.anio)] = {
      recibo_id: recibo.id,
      estado: recibo.estado,
    };
  }

  const cuotaPorAlumno = Object.fromEntries((tarifas || []).map((t) => [t.alumno_id, Number(t.precio_neto) || 0]));

  const filas = (alumnos || []).map((a) => ({
    alumno_id: a.id,
    nombre_alumno: a.nombre,
    familia_nombre: a.familia?.nombre || "",
    cuota: cuotaPorAlumno[a.id] || 0,
    meses: curso.map((c) => {
      const entrada = reciboPorAlumnoYMes[a.id]?.[claveMesAnio(c.mes, c.anio)];
      return { mes: c.mes, anio: c.anio, recibo_id: entrada?.recibo_id || null, estado: entrada?.estado || null };
    }),
  }));

  return { filas };
}

// "Recibos del mes": uno por familia (no por alumno) con su importe y
// estado — lo que ya muestra el panel "Envío a familias", reutilizado
// aquí con las columnas que pide la vista de Ingresos.
export async function fetchRecibosDelMesFinanzas(admin, tenantId, { mes, anio }) {
  const { data, error } = await admin
    .from("academia_recibos")
    .select("id, total_neto, fecha_envio, estado, familia:academia_familias(nombre)")
    .eq("tenant_id", tenantId)
    .eq("mes", mes)
    .eq("anio", anio)
    .order("created_at", { ascending: true });
  if (error) return { error };

  const recibos = (data || []).map((r) => ({
    id: r.id,
    familia_nombre: r.familia?.nombre || "",
    importe: Number(r.total_neto),
    fecha_envio: r.fecha_envio,
    estado: r.estado,
  }));
  return { recibos };
}

// Todos los recibos ya enviados o pagados, de cualquier mes/año — vista
// "Historial" de Ingresos (a diferencia de "Recibos del mes", que solo
// mira el período seleccionado).
export async function fetchHistorialRecibos(admin, tenantId) {
  const { data, error } = await admin
    .from("academia_recibos")
    .select("id, mes, anio, total_neto, fecha_envio, fecha_pago, estado, familia:academia_familias(nombre)")
    .eq("tenant_id", tenantId)
    .in("estado", ["enviado", "pagado"])
    .order("anio", { ascending: false })
    .order("mes", { ascending: false });
  if (error) return { error };

  const recibos = (data || []).map((r) => ({
    id: r.id,
    mes: r.mes,
    anio: r.anio,
    familia_nombre: r.familia?.nombre || "",
    importe: Number(r.total_neto),
    fecha_envio: r.fecha_envio,
    fecha_pago: r.fecha_pago,
    estado: r.estado,
  }));
  return { recibos };
}
