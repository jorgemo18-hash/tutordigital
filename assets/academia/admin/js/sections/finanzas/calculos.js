// Constantes y cálculos compartidos por las 3 pestañas de Finanzas — ya
// no hay datos de ejemplo aquí (ver mockData.js, eliminado), solo lo que
// necesita la UI para mostrar/calcular antes de guardar.
export const MESES = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];

// El admin introduce el importe TOTAL (lo que paga) y el tipo de IVA; base
// imponible e IVA€ se derivan desde ahí (al revés que en un presupuesto,
// donde se parte de la base). Sin IVA no hay nada que desglosar.
export function calcGastoDesdeImporte({ importe, ivaPct }) {
  const total = Number(importe) || 0;
  const pct = Number(ivaPct) || 0;
  if (!pct) return { baseImponible: null, ivaImporte: null };
  const baseImponible = Math.round((total / (1 + pct / 100)) * 100) / 100;
  const ivaImporte = Math.round((total - baseImponible) * 100) / 100;
  return { baseImponible, ivaImporte };
}
