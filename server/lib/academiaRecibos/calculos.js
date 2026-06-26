export const MESES = [
  null, "enero", "febrero", "marzo", "abril", "mayo", "junio",
  "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre",
];

export function formatearConcepto(plantilla, mes, anio, academiaNombre = "") {
  const base = plantilla || "Clases {mes} {año}";
  return base
    .split("{mes}").join(MESES[mes] || "")
    .split("{año}").join(String(anio))
    .split("{academia}").join(academiaNombre);
}

// Hermanos y descuento puntual se aplican como dos porcentajes sumados
// sobre el bruto, no encadenados — más fácil de explicar en el recibo.
export function calcularDescuento({ totalBruto, descuentoHermanosPct = 0, descuentoPuntualPct = 0 }) {
  const bruto = Number(totalBruto) || 0;
  const pctTotal = (Number(descuentoHermanosPct) || 0) + (Number(descuentoPuntualPct) || 0);
  const totalDescuento = Math.round(bruto * (pctTotal / 100) * 100) / 100;
  const totalNeto = Math.round((bruto - totalDescuento) * 100) / 100;
  return { totalDescuento, totalNeto };
}

export async function siguienteNumeroRecibo(admin, tenantId, anio) {
  const { count, error } = await admin
    .from("academia_recibos")
    .select("id", { count: "exact", head: true })
    .eq("tenant_id", tenantId);
  if (error) return { error };
  const contador = String((count || 0) + 1).padStart(3, "0");
  return { numero: `REC-${anio}-${contador}` };
}
