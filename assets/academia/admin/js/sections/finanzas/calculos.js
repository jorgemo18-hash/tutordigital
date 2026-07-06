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

// Agregación en cliente de una lista ya cargada de gastos — usada por la
// vista de trimestre de Gastos (fetchGastosTrimestre ya trae los 3 meses
// juntos, sin endpoint propio de resumen/categorías por trimestre). Mismas
// fórmulas que server/lib/academiaFinanzas/gastosConsultas.js, para que el
// resultado sea idéntico al que daría el backend por mes.
export function agregarResumenGastos(gastos) {
  const total = gastos.reduce((s, g) => s + Number(g.importe), 0);
  const ivaSoportado = gastos.reduce((s, g) => s + Number(g.iva_importe || 0), 0);
  const ticketMedio = gastos.length ? total / gastos.length : 0;
  return {
    total: Math.round(total * 100) / 100,
    iva_soportado: Math.round(ivaSoportado * 100) / 100,
    ticket_medio: Math.round(ticketMedio * 100) / 100,
  };
}

export function agregarCategoriasGastos(gastos) {
  const porCategoria = {};
  for (const g of gastos) {
    const cat = g.categoria || "Sin categoría";
    porCategoria[cat] = (porCategoria[cat] || 0) + Number(g.importe);
  }
  return Object.entries(porCategoria).map(([categoria, total]) => ({
    categoria,
    total: Math.round(total * 100) / 100,
  }));
}
