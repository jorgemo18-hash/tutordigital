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

// Desglosa los descuentos recurrentes que aplican a UN alumno en líneas
// individuales con su propio importe en euros (snapshot guardado en la
// línea del recibo, ver generarRecibo.js): los acumulables se incluyen
// todos; de los no acumulables solo el de mayor porcentaje, que cuenta
// aparte. El importe de cada línea se calcula sobre el bruto del alumno,
// no se encadenan unos descuentos sobre otros.
export function desglosarDescuentosRecurrentes(descuentos = [], bruto = 0) {
  const acumulables = descuentos.filter((d) => d.acumulable && Number(d.porcentaje) > 0);
  const noAcumulables = descuentos.filter((d) => !d.acumulable && Number(d.porcentaje) > 0);
  const mayorNoAcumulable = noAcumulables.reduce(
    (mayor, d) => (!mayor || Number(d.porcentaje) > Number(mayor.porcentaje) ? d : mayor),
    null
  );
  const aplicados = mayorNoAcumulable ? [...acumulables, mayorNoAcumulable] : acumulables;
  return aplicados.map((d) => ({
    concepto: d.concepto,
    porcentaje: Number(d.porcentaje),
    importe: Math.round((((Number(bruto) || 0) * Number(d.porcentaje)) / 100) * 100) / 100,
  }));
}

// Hermanos y descuento puntual se calculan como porcentajes sobre el bruto
// total de la familia; el importe de los descuentos recurrentes ya viene
// sumado desde fuera (cada alumno tiene su propio desglose, ver
// desglosarDescuentosRecurrentes) porque se calculan sobre el bruto de
// cada alumno, no sobre el total de la familia.
export function calcularDescuento({ totalBruto, descuentoHermanosPct = 0, descuentoPuntualPct = 0, descuentoRecurrenteImporte = 0 }) {
  const bruto = Number(totalBruto) || 0;
  const hermanosImporte = Math.round((bruto * (Number(descuentoHermanosPct) || 0)) / 100 * 100) / 100;
  const puntualImporte = Math.round((bruto * (Number(descuentoPuntualPct) || 0)) / 100 * 100) / 100;
  const totalDescuento = Math.round((hermanosImporte + puntualImporte + (Number(descuentoRecurrenteImporte) || 0)) * 100) / 100;
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
