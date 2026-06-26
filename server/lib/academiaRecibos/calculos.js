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

// ¿Este tipo de descuento recurrente aplica al período (mes/anio) del
// recibo, según la fecha_alta del alumno? "primer_trimestre" cuenta los
// 3 primeros meses desde fecha_alta inclusive (mesesDesdeAlta 0, 1 o 2).
export function intervaloAplica(intervalo, { fechaAlta, mes, anio }) {
  if (intervalo === "siempre") return true;
  if (!fechaAlta) return false;
  const [altaAnioStr, altaMesStr] = String(fechaAlta).split("-");
  const altaAnio = Number(altaAnioStr);
  const altaMes = Number(altaMesStr);
  if (intervalo === "primer_mes") return mes === altaMes && anio === altaAnio;
  if (intervalo === "primer_trimestre") {
    const mesesDesdeAlta = (anio - altaAnio) * 12 + (mes - altaMes);
    return mesesDesdeAlta >= 0 && mesesDesdeAlta <= 2;
  }
  return false;
}

// Combina varios descuentos recurrentes en un único porcentaje efectivo:
// los acumulables se suman entre sí; de los no acumulables solo cuenta el
// de mayor porcentaje, que se añade aparte a la suma de los acumulables.
export function combinarPorcentajes(descuentos = []) {
  let sumaAcumulables = 0;
  let mayorNoAcumulable = 0;
  for (const d of descuentos) {
    const pct = Number(d.porcentaje) || 0;
    if (d.acumulable) sumaAcumulables += pct;
    else if (pct > mayorNoAcumulable) mayorNoAcumulable = pct;
  }
  return sumaAcumulables + mayorNoAcumulable;
}

// Hermanos, descuento puntual y el combinado de descuentos recurrentes que
// ya aplican (ver intervaloAplica) se suman como porcentajes sobre el
// bruto, no se encadenan — más fácil de explicar en el recibo.
export function calcularDescuento({ totalBruto, descuentoHermanosPct = 0, descuentoPuntualPct = 0, descuentosRecurrentes = [] }) {
  const bruto = Number(totalBruto) || 0;
  const pctRecurrentes = combinarPorcentajes(descuentosRecurrentes);
  const pctTotal = (Number(descuentoHermanosPct) || 0) + (Number(descuentoPuntualPct) || 0) + pctRecurrentes;
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
