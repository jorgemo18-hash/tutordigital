import { COLUMNAS_DEDUCIBLE, sumarDeducibles } from "./gastoDeducible.js";
import { fetchIngresosDelPeriodo } from "./ingresosDelPeriodo.js";

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
  // Mismo criterio que Resumen, desde el mismo sitio (ingresosDelPeriodo.js):
  // la casilla [01] de un modelo que se presenta no puede salir de un filtro
  // escrito a mano aquí y otro allí.
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

  return {
    calculado: {
      ingresos: Math.round(ingresos * 100) / 100,
      gastos_deducibles: Math.round(gastosDeducibles * 100) / 100,
      // Para la nota de la casilla [01]: el admin tiene que poder ver que el
      // número propuesto es lo COBRADO y cuánto hay emitido sin cobrar,
      // porque la casilla es editable y la decisión de qué poner es suya (y
      // de su gestor).
      facturado: ingresosPeriodo.facturado,
      pendiente_de_cobro: ingresosPeriodo.pendiente_de_cobro,
      gastos_registrados: (gastos || []).length,
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
