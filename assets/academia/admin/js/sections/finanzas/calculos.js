// Constantes y cálculos compartidos por las 3 pestañas de Finanzas — ya
// no hay datos de ejemplo aquí (ver mockData.js, eliminado), solo lo que
// necesita la UI para mostrar/calcular antes de guardar.
export const MESES = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];
export const CATEGORIAS_GASTO = ["Material", "Suministros", "Alquiler", "Marketing", "Otros"];

export function calcGasto({ baseImponible, ivaPct, retencionPct }) {
  const base = Number(baseImponible) || 0;
  const iva = Math.round(base * ((Number(ivaPct) || 0) / 100) * 100) / 100;
  const retencion = Math.round(base * ((Number(retencionPct) || 0) / 100) * 100) / 100;
  const total = Math.round((base + iva - retencion) * 100) / 100;
  return { ivaImporte: iva, retencionImporte: retencion, total };
}
