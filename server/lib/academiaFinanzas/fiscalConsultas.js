// Consultas de la pestaña Fiscal (Modelo 130/115/111) — todos los cálculos
// (rendimiento neto, IVA, retenciones, totales) son del lado del cliente,
// aquí solo se leen los datos crudos: ingresos/gastos del trimestre
// (Modelo 130) y los valores editables guardados en academia_config
// (alquiler_base_mensual para el 115, nominas_config para el 111).
const MESES_TRIMESTRE = { 1: [1, 2, 3], 2: [4, 5, 6], 3: [7, 8, 9], 4: [10, 11, 12] };

function rangoTrimestre(anio, trimestre) {
  const meses = MESES_TRIMESTRE[trimestre];
  const inicio = `${anio}-${String(meses[0]).padStart(2, "0")}-01`;
  const ultimoMes = meses[meses.length - 1];
  const finMes = new Date(anio, ultimoMes, 0).getDate();
  const fin = `${anio}-${String(ultimoMes).padStart(2, "0")}-${String(finMes).padStart(2, "0")}`;
  return { inicio, fin };
}

// Modelo 130 — casillas [01] y [02]: el resto (rendimiento neto, 20%,
// minoración, resultado) se calcula en el frontend a partir de estas dos.
export async function fetchModelo130(admin, tenantId, { anio, trimestre }) {
  const meses = MESES_TRIMESTRE[trimestre];
  const { inicio, fin } = rangoTrimestre(anio, trimestre);
  const [{ data: recibos, error: errRecibos }, { data: gastos, error: errGastos }] = await Promise.all([
    admin.from("academia_recibos").select("total_neto").eq("tenant_id", tenantId).eq("anio", anio).in("mes", meses).eq("estado", "pagado"),
    admin.from("academia_gastos").select("base_imponible").eq("tenant_id", tenantId).gte("fecha", inicio).lte("fecha", fin),
  ]);
  if (errRecibos || errGastos) return { error: errRecibos || errGastos };

  const ingresos = (recibos || []).reduce((s, r) => s + Number(r.total_neto), 0);
  const gastosDeducibles = (gastos || []).reduce((s, g) => s + Number(g.base_imponible || 0), 0);

  return {
    modelo130: {
      ingresos: Math.round(ingresos * 100) / 100,
      gastos_deducibles: Math.round(gastosDeducibles * 100) / 100,
    },
  };
}

// Modelo 115 — un único valor global (no varía por trimestre/año), de ahí
// que no se filtre por esos parámetros: la base mensual del alquiler.
export async function fetchAlquilerBaseMensual(admin, tenantId) {
  const { data, error } = await admin.from("academia_config").select("alquiler_base_mensual").eq("tenant_id", tenantId).maybeSingle();
  if (error) return { error };
  return { alquiler_base_mensual: Number(data?.alquiler_base_mensual || 0) };
}

function claveNominas(trimestre, anio) {
  return `T${trimestre}_${anio}`;
}

// Modelo 111 — a diferencia del alquiler, la base de nóminas y su % de
// retención sí varían por trimestre (se guardan en nominas_config bajo la
// clave "T{trimestre}_{anio}"). Se devuelven los 4 trimestres del año para
// que el frontend pueda sumar la sección anual (Modelo 190) sin 4 fetches,
// y también el objeto nominas_config crudo (con todos los años) — el PUT
// /academia/config sobrescribe la columna entera, así que para guardar un
// trimestre sin perder el resto el frontend necesita el objeto completo
// para mezclar su cambio antes de reenviarlo.
export async function fetchNominasAnio(admin, tenantId, anio) {
  const { data, error } = await admin.from("academia_config").select("nominas_config").eq("tenant_id", tenantId).maybeSingle();
  if (error) return { error };

  const config = data?.nominas_config || {};
  const trimestres = [1, 2, 3, 4].map((t) => {
    const entry = config[claveNominas(t, anio)] || {};
    return {
      trimestre: t,
      base_trimestral: Number(entry.base ?? 0),
      retencion_pct: Number(entry.retencion_pct ?? 15),
    };
  });
  return { trimestres, nominas_config: config };
}
