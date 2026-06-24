// Datos de ejemplo para Finanzas — sin backend todavía.
export const MESES = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];
export const CATEGORIAS_GASTO = ["Material", "Suministros", "Alquiler", "Marketing", "Otros"];

export function buildMockFinanzas() {
  return {
    cobros: [
      { id: "c1", familia: "Familia Pérez", alumno: "Marta Pérez", importe: 90, meses: [true, true, true, false, false, false] },
      { id: "c2", familia: "Familia Ruiz", alumno: "Diego Ruiz", importe: 75, meses: [true, true, false, false, false, false] },
      { id: "c3", familia: "Familia Soto", alumno: "Aitana Soto", importe: 110, meses: [true, false, false, false, false, false] },
      { id: "c4", familia: "Familia López", alumno: "Pablo López", importe: 90, meses: [true, true, true, true, false, false] },
    ],
    recibosDelMes: [
      { id: "r1", familia: "Familia Pérez", alumno: "Marta Pérez", importe: 90, fecha: "2026-06-01", estado: "pagado" },
      { id: "r2", familia: "Familia Ruiz", alumno: "Diego Ruiz", importe: 75, fecha: "2026-06-02", estado: "pendiente" },
      { id: "r3", familia: "Familia Soto", alumno: "Aitana Soto", importe: 110, fecha: "2026-06-01", estado: "pagado" },
    ],
    gastos: [
      { id: "g1", fecha: "2026-06-03", proveedor: "Papelería Centro", concepto: "Material didáctico", cif: "B12345678", categoria: "Material", baseImponible: 120, ivaPct: 21, retencionPct: 0 },
      { id: "g2", fecha: "2026-06-05", proveedor: "Iberdrola", concepto: "Factura luz", cif: "A98765432", categoria: "Suministros", baseImponible: 95, ivaPct: 21, retencionPct: 0 },
      { id: "g3", fecha: "2026-06-01", proveedor: "Inmobiliaria Sol", concepto: "Alquiler local", cif: "B11223344", categoria: "Alquiler", baseImponible: 800, ivaPct: 21, retencionPct: 19 },
    ],
    ingresosPorMes: [4200, 4350, 4100, 4600, 4500, 4700, 0, 0, 0, 0, 0, 0],
    gastosPorMes: [1100, 1050, 1300, 1200, 1150, 1250, 0, 0, 0, 0, 0, 0],
  };
}

export function calcGasto({ baseImponible, ivaPct, retencionPct }) {
  const base = Number(baseImponible) || 0;
  const iva = Math.round(base * ((Number(ivaPct) || 0) / 100) * 100) / 100;
  const retencion = Math.round(base * ((Number(retencionPct) || 0) / 100) * 100) / 100;
  const total = Math.round((base + iva - retencion) * 100) / 100;
  return { ivaImporte: iva, retencionImporte: retencion, total };
}

export function totalGasto(gasto) {
  return calcGasto(gasto).total;
}
