export const MESES = [
  null, "enero", "febrero", "marzo", "abril", "mayo", "junio",
  "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre",
];

// Redondeo a céntimos, half-up — único punto de la app que redondea a 2
// decimales (antes triplicado en este archivo como Math.round(x*100)/100,
// más una 4ª copia del mismo patrón en generarRecibo.js).
//
// CORREGIDO 2026-07-11 (antes: Math.round(x*100)/100, ver commit anterior).
// Ese patrón hereda el error de representación binaria de `x*100`
// (round2(1.005) daba 1, no 1.01, porque 1.005*100 vale
// 100.49999999999999 en coma flotante — confirmado con un barrido de 550k
// combinaciones bruto/porcentaje realistas, 271 de ellas con desviación).
//
// El truco obvio "Number(x.toFixed(10)) * 100" NO arregla esto: toFixed(10)
// sí recupera el valor decimal correcto como STRING, pero Number(str)
// vuelve a parsear ese string al MISMO double impreciso de partida, y el
// *100 posterior reintroduce exactamente el mismo error (verificado: 212 de
// 550k combinaciones seguían mal con ese enfoque). La solución real es
// extraer los céntimos como enteros directamente del string de alta
// precisión, sin volver a pasar por una multiplicación en coma flotante.
// Verificado sin mismatches en las mismas 550k combinaciones + las 346.200
// (calcularDescuento) y 1.765 (desglosarDescuentosRecurrentes) del refactor
// anterior, que siguen manteniendo total_neto + total_descuento ===
// total_bruto exacto al céntimo. Efecto solo hacia adelante: los recibos ya
// emitidos no se regeneran (son internamente consistentes, desviación
// ≤1 céntimo por línea como mucho).
export function round2(value) {
  const num = Number(value) || 0;
  const neg = num < 0;
  // 12 decimales: margen de sobra sobre los ~15-17 dígitos significativos
  // de un double — suficiente para que toFixed "recupere" el decimal
  // realmente escrito/calculado, sin acercarse al límite de precisión.
  const fixed = Math.abs(num).toFixed(12);
  const [intPart, decPart] = fixed.split(".");
  const centsWhole = Number(intPart) * 100 + Number(decPart.slice(0, 2));
  const thirdDigit = Number(decPart[2]);
  const cents = thirdDigit >= 5 ? centsWhole + 1 : centsWhole;
  return (neg ? -1 : 1) * cents / 100;
}

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
    importe: round2(((Number(bruto) || 0) * Number(d.porcentaje)) / 100),
  }));
}

// Hermanos y descuento puntual se calculan como porcentajes sobre el bruto
// total de la familia; el importe de los descuentos recurrentes ya viene
// sumado desde fuera (cada alumno tiene su propio desglose, ver
// desglosarDescuentosRecurrentes) porque se calculan sobre el bruto de
// cada alumno, no sobre el total de la familia.
export function calcularDescuento({ totalBruto, descuentoHermanosPct = 0, descuentoPuntualPct = 0, descuentoRecurrenteImporte = 0 }) {
  const bruto = Number(totalBruto) || 0;
  const hermanosImporte = round2((bruto * (Number(descuentoHermanosPct) || 0)) / 100);
  const puntualImporte = round2((bruto * (Number(descuentoPuntualPct) || 0)) / 100);
  const totalDescuento = round2(hermanosImporte + puntualImporte + (Number(descuentoRecurrenteImporte) || 0));
  const totalNeto = round2(bruto - totalDescuento);
  return { totalDescuento, totalNeto };
}

// Siguiente número libre de la serie REC-<anio>-<NNN> de ese centro.
//
// Antes contaba TODOS los recibos del tenant (de cualquier año) y sumaba 1.
// Tres defectos en una línea, los tres observados en producción:
//   - la serie no reiniciaba por año: el primer recibo de 2027 salía
//     REC-2027-045 si en 2026 había 44;
//   - regenerar es DELETE + INSERT, así que el contador BAJABA y volvía a
//     emitir un número ya usado (en la BD real hay un REC-2026-008
//     duplicado, uno en borrador y otro ya enviado a la familia);
//   - un borrado dejaba hueco y luego lo reutilizaba (falta el REC-2026-006).
//
// Ahora se toma el MÁXIMO de la serie del año, no el recuento: es monótono,
// nunca reutiliza un número aunque se borren filas, y los huecos se quedan
// como huecos — que es lo correcto en una numeración de documentos.
//
// Se leen los números del año en vez de pedir un max() al servidor porque
// PostgREST no expone agregados sobre una expresión; son unos cientos de
// filas por año como mucho. Al regenerar un recibo NO se llama aquí: se
// conserva el número original (ver generarRecibo.js).
export async function siguienteNumeroRecibo(admin, tenantId, anio) {
  const prefijo = `REC-${anio}-`;
  const { data, error } = await admin
    .from("academia_recibos")
    .select("numero_recibo")
    .eq("tenant_id", tenantId)
    .like("numero_recibo", `${prefijo}%`);
  if (error) return { error };

  let maximo = 0;
  for (const fila of data || []) {
    const sufijo = String(fila?.numero_recibo || "").slice(prefijo.length);
    if (!/^\d+$/.test(sufijo)) continue;
    const valor = Number(sufijo);
    if (valor > maximo) maximo = valor;
  }

  return { numero: `${prefijo}${String(maximo + 1).padStart(3, "0")}` };
}
