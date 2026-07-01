// Datos reales de Ingresos/Gastos para Modelo 130 — el único modelo cuyas
// casillas [01]/[02] no se pueden derivar de nada que el admin escriba a
// mano, hay que leerlas de academia_recibos/academia_gastos. El resto de
// modelos (202/115/111) son enteramente editables/calculados a partir de
// esos valores, ver fiscalTrimestresStore.js para su persistencia.
const MESES_TRIMESTRE = { 1: [1, 2, 3], 2: [4, 5, 6], 3: [7, 8, 9], 4: [10, 11, 12] };

function rangoTrimestre(anio, trimestre) {
  const meses = MESES_TRIMESTRE[trimestre];
  const inicio = `${anio}-${String(meses[0]).padStart(2, "0")}-01`;
  const ultimoMes = meses[meses.length - 1];
  const finMes = new Date(anio, ultimoMes, 0).getDate();
  const fin = `${anio}-${String(ultimoMes).padStart(2, "0")}-${String(finMes).padStart(2, "0")}`;
  return { inicio, fin };
}

export async function fetchIngresosGastosTrimestre(admin, tenantId, { anio, trimestre }) {
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
    calculado: {
      ingresos: Math.round(ingresos * 100) / 100,
      gastos_deducibles: Math.round(gastosDeducibles * 100) / 100,
    },
  };
}

// Cuota de IVA soportada deducible para Modelo 303 — suma iva_importe de
// todos los gastos del trimestre registrados con desglose (iva_importe > 0).
// Se usa como valor inicial de la casilla [20]; el admin puede sobrescribirlo.
export async function fetchIvaDeducibleTrimestre(admin, tenantId, { anio, trimestre }) {
  const { inicio, fin } = rangoTrimestre(anio, trimestre);
  const { data, error } = await admin
    .from("academia_gastos")
    .select("iva_importe")
    .eq("tenant_id", tenantId)
    .gte("fecha", inicio)
    .lte("fecha", fin);
  if (error) return { error };
  const total = (data || []).reduce((s, g) => s + Number(g.iva_importe || 0), 0);
  return { iva_deducible: Math.round(total * 100) / 100 };
}
