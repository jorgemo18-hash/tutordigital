import { mesesDelCurso, claveMesAnio } from "./cursoAcademico.js";

// Vista "Pendientes": alumnos con recibo ese mes, agrupados por el
// metodo_pago de su familia — un recibo es por familia, así que todos los
// hermanos de una misma familia comparten recibo_id y estado.
export async function fetchPendientesAgrupados(admin, tenantId, { mes, anio }) {
  const { data: recibos, error: errRecibos } = await admin
    .from("academia_recibos")
    .select("id, estado, familia:academia_familias(nombre, metodo_pago)")
    .eq("tenant_id", tenantId)
    .eq("mes", mes)
    .eq("anio", anio);
  if (errRecibos) return { error: errRecibos };

  const reciboIds = (recibos || []).map((r) => r.id);
  const { data: lineas, error: errLineas } = reciboIds.length
    ? await admin.from("academia_recibos_lineas").select("alumno_id, recibo_id, nombre_alumno").in("recibo_id", reciboIds)
    : { data: [] };
  if (errLineas) return { error: errLineas };

  const alumnoIds = [...new Set((lineas || []).map((l) => l.alumno_id))];
  const { data: tarifas, error: errTarifas } = alumnoIds.length
    ? await admin.from("academia_tarifas").select("alumno_id, precio_neto").eq("tenant_id", tenantId).in("alumno_id", alumnoIds).is("fecha_fin", null)
    : { data: [] };
  if (errTarifas) return { error: errTarifas };

  const cuotaPorAlumno = Object.fromEntries((tarifas || []).map((t) => [t.alumno_id, Number(t.precio_neto) || 0]));
  const recibosPorId = Object.fromEntries((recibos || []).map((r) => [r.id, r]));

  const gruposPorMetodo = {};
  for (const linea of lineas || []) {
    const recibo = recibosPorId[linea.recibo_id];
    if (!recibo) continue;
    const metodoPago = recibo.familia?.metodo_pago || null;
    (gruposPorMetodo[metodoPago] ||= []).push({
      recibo_id: recibo.id,
      alumno_nombre: linea.nombre_alumno,
      familia_nombre: recibo.familia?.nombre || "",
      cuota: cuotaPorAlumno[linea.alumno_id] || 0,
      estado: recibo.estado,
    });
  }

  const grupos = Object.entries(gruposPorMetodo).map(([metodo_pago, alumnos]) => ({ metodo_pago, alumnos }));
  return { grupos };
}

// Grid anual por alumno: una fila por alumno activo, una columna por cada
// mes del curso que contiene (mes, anio), con el estado de su recibo ese
// mes (a través de academia_recibos_lineas, que es la única tabla que liga
// alumno_id con un recibo concreto — los recibos son por familia, no por
// alumno). La usan tanto "Pendientes" (curso del mes seleccionado) como
// "Historial" (curso del año seleccionado).
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
