import { COLUMNAS_DEDUCIBLE, sumarDeducibles } from "./gastoDeducible.js";

// A diferencia de ingresosConsultas.js (curso académico, sep-ago), aquí
// "año" es año fiscal/calendario (ene-dic) — el Modelo 130 de IRPF es por
// año natural, no por curso.
import { rangoMes, rangoTrimestre, rangoAnio, mesesDelTrimestre } from "./rangoFechas.js";
import { fetchIngresosDelPeriodo } from "./ingresosDelPeriodo.js";

export async function fetchResumenMensual(admin, tenantId, anio) {
  const { inicio, fin } = rangoAnio(anio);
  // El criterio (hoy, caja) vive en ingresosDelPeriodo.js, no repetido aquí
  // con un `.eq("estado","pagado")` a mano.
  const [ingresos, { data: gastos, error: errGastos }] = await Promise.all([
    fetchIngresosDelPeriodo(admin, tenantId, { anio }),
    admin.from("academia_gastos").select("fecha, importe").eq("tenant_id", tenantId).gte("fecha", inicio).lte("fecha", fin),
  ]);
  if (ingresos.error || errGastos) return { error: ingresos.error || errGastos };

  const ingresosPorMes = ingresos.cobrado_por_mes;

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

  const [ingresosPeriodo, { data: gastos, error: errGastos }] = await Promise.all([
    fetchIngresosDelPeriodo(admin, tenantId, { anio, meses }),
    admin.from("academia_gastos").select(COLUMNAS_DEDUCIBLE).eq("tenant_id", tenantId).gte("fecha", inicio).lte("fecha", fin),
  ]);
  if (ingresosPeriodo.error || errGastos) return { error: ingresosPeriodo.error || errGastos };

  const ingresos = ingresosPeriodo.cobrado;
  // Sin desglose de IVA no hay base imponible: se suma el importe entero
  // (ver gastoDeducible.js). Sumar solo la base hacía que un gasto sin
  // desglosar contara CERO euros deducibles.
  const gastosDeducibles = sumarDeducibles(gastos);
  const rendimientoNeto = ingresos - gastosDeducibles;
  const pagoFraccionado = Math.max(0, rendimientoNeto * 0.2);

  return {
    fiscal: {
      // `ingresos` sigue siendo LO COBRADO: es lo que entra en el cálculo y
      // en la casilla del Modelo 130.
      ingresos: Math.round(ingresos * 100) / 100,
      gastos_deducibles: Math.round(gastosDeducibles * 100) / 100,
      rendimiento_neto: Math.round(rendimientoNeto * 100) / 100,
      pago_fraccionado: Math.round(pagoFraccionado * 100) / 100,
      // Y estas tres viajan para que la pantalla pueda explicar el número en
      // vez de soltarlo: 0 € de ingresos con 2.388 € emitidos se lee como
      // "no he ganado nada" si nadie dice que son los cobrados.
      facturado: ingresosPeriodo.facturado,
      pendiente_de_cobro: ingresosPeriodo.pendiente_de_cobro,
      // Cero gastos registrados no es lo mismo que cero gastos: casi siempre
      // significa que aún no se han metido, y el rendimiento neto sale
      // inflado. La pantalla lo avisa.
      gastos_registrados: (gastos || []).length,
    },
  };
}
