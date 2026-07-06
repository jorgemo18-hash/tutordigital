// A diferencia de ingresosConsultas.js (curso académico, sep-ago), aquí
// "año" es año fiscal/calendario (ene-dic) — el Modelo 130 de IRPF es por
// año natural, no por curso.
import { rangoMes, rangoTrimestre, rangoAnio, mesesDelTrimestre } from "./rangoFechas.js";

export async function fetchResumenMensual(admin, tenantId, anio) {
  const { inicio, fin } = rangoAnio(anio);
  const [{ data: recibos, error: errRecibos }, { data: gastos, error: errGastos }] = await Promise.all([
    admin.from("academia_recibos").select("mes, total_neto").eq("tenant_id", tenantId).eq("anio", anio).eq("estado", "pagado"),
    admin.from("academia_gastos").select("fecha, importe").eq("tenant_id", tenantId).gte("fecha", inicio).lte("fecha", fin),
  ]);
  if (errRecibos || errGastos) return { error: errRecibos || errGastos };

  const ingresosPorMes = Array(12).fill(0);
  for (const r of recibos || []) ingresosPorMes[r.mes - 1] += Number(r.total_neto);

  const gastosPorMes = Array(12).fill(0);
  for (const g of gastos || []) gastosPorMes[new Date(g.fecha).getUTCMonth()] += Number(g.importe);

  return {
    meses: ingresosPorMes.map((ingresos, i) => ({
      mes: i + 1,
      ingresos: Math.round(ingresos * 100) / 100,
      gastos: Math.round(gastosPorMes[i] * 100) / 100,
    })),
  };
}

// Rendimiento neto = ingresos - gastos deducibles (la base imponible de
// cada gasto, sin el IVA soportado, que no es deducible en IRPF). Pago
// fraccionado: 20% del rendimiento neto (Modelo 130), nunca negativo.
// `periodo` acota a un mes o trimestre concretos — sin ninguno de los dos,
// se calcula el año completo (comportamiento de siempre).
export async function fetchResumenFiscal(admin, tenantId, anio, { mes, trimestre } = {}) {
  const meses = mes ? [mes] : trimestre ? mesesDelTrimestre(trimestre) : null;
  const { inicio, fin } = mes ? rangoMes(mes, anio) : trimestre ? rangoTrimestre(trimestre, anio) : rangoAnio(anio);

  let recibosQuery = admin
    .from("academia_recibos")
    .select("total_neto")
    .eq("tenant_id", tenantId)
    .eq("anio", anio)
    .eq("estado", "pagado");
  if (meses) recibosQuery = recibosQuery.in("mes", meses);

  const [{ data: recibos, error: errRecibos }, { data: gastos, error: errGastos }] = await Promise.all([
    recibosQuery,
    admin.from("academia_gastos").select("base_imponible").eq("tenant_id", tenantId).gte("fecha", inicio).lte("fecha", fin),
  ]);
  if (errRecibos || errGastos) return { error: errRecibos || errGastos };

  const ingresos = (recibos || []).reduce((s, r) => s + Number(r.total_neto), 0);
  const gastosDeducibles = (gastos || []).reduce((s, g) => s + Number(g.base_imponible || 0), 0);
  const rendimientoNeto = ingresos - gastosDeducibles;
  const pagoFraccionado = Math.max(0, rendimientoNeto * 0.2);

  return {
    fiscal: {
      ingresos: Math.round(ingresos * 100) / 100,
      gastos_deducibles: Math.round(gastosDeducibles * 100) / 100,
      rendimiento_neto: Math.round(rendimientoNeto * 100) / 100,
      pago_fraccionado: Math.round(pagoFraccionado * 100) / 100,
    },
  };
}
