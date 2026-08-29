// Cuánto de un gasto es deducible en IRPF (casilla [02] del Modelo 130).
//
// EL FALLO QUE ARREGLA, que era de dinero: los dos sitios que suman gastos
// (fiscalConsultas.js y resumenConsultas.js) sumaban `base_imponible`, y
// esa columna se queda en NULL siempre que el gasto se registra sin
// desglosar el IVA — que es el caso por defecto, porque el interruptor
// "Desglosar IVA" está apagado. Resultado: un gasto de 120 € sin desglose
// contaba CERO euros deducibles. No es un redondeo: es el gasto entero
// desaparecido del Modelo 130, y de ahí sale un pago fraccionado más alto
// del que toca.
//
// La regla:
//
//   - SIN desglose no hay base imponible que sumar. Lo único que existe es
//     el importe total, y es además lo correcto en una actividad exenta de
//     IVA (la enseñanza lo está): al no poder deducirse el IVA soportado,
//     ese IVA forma parte del coste y es gasto deducible en IRPF.
//   - CON desglose se suma la base. Un centro solo rellena el desglose si
//     declara IVA, y entonces el IVA soportado se recupera por el 303: irse
//     al total sería deducirlo dos veces.
//
// Por eso no hace falta un ajuste nuevo ni preguntarle nada al admin: el
// propio desglose ya dice en qué situación está el centro.
export function importeDeducible(gasto) {
  const base = gasto?.base_imponible;
  if (base !== null && base !== undefined && base !== "") return Number(base) || 0;
  return Number(gasto?.importe) || 0;
}

// Las dos consultas piden las MISMAS columnas y suman igual: se escribe una
// vez aquí para que no vuelvan a divergir (el fallo estaba duplicado
// literalmente en las dos).
export const COLUMNAS_DEDUCIBLE = "importe, base_imponible";

export function sumarDeducibles(gastos) {
  const total = (gastos || []).reduce((suma, gasto) => suma + importeDeducible(gasto), 0);
  return Math.round(total * 100) / 100;
}
