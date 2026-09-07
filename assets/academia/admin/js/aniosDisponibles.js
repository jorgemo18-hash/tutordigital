// Qué años se pueden elegir en los selectores de período (Ingresos, Gastos,
// Resumen, Fiscal y Envío a familias).
//
// LA REGLA. Del año actual hacia atrás, nunca hacia delante, con seis años
// de recorrido: hoy (2026) van de 2020 a 2026. Hacia delante no se ofrece
// nada porque no existe un recibo de 2028 — elegirlo solo lleva a una
// pantalla vacía y a preguntarse si se ha roto algo. (Los cinco selectores
// hacían `for (a = 2024; a <= actual + 2)`, que es exactamente eso.)
//
// POR QUÉ SE OFRECEN AÑOS VACÍOS, A PROPÓSITO. La versión anterior cortaba
// en 2024 con el argumento de que antes no había datos. Está mal, y la razón
// es la de Jorge: un centro que empieza a usar la app tiene que poder METER
// los gastos y los ingresos de años anteriores. Con la lista atada a los
// años que ya tienen datos, 2022 no se puede abrir porque está vacío, y está
// vacío porque no se puede abrir. Un año vacío que se puede rellenar es
// mucho más barato que un año al que no se puede llegar.
//
// Y POR QUÉ LA LISTA SOLO CRECE. `desde` se queda en PRIMER_ANIO aunque la
// ventana de seis años lo deje atrás: una ventana estrictamente deslizante
// dejaría de ofrecer 2025 en 2032, con los datos de 2025 dentro. Un año con
// movimientos no puede desaparecer del desplegable porque haya pasado el
// tiempo — eso no es limpieza, es esconder la contabilidad. Los datos NUNCA
// se borran (el Código de Comercio pide conservarlos 6 años desde el último
// asiento, y la evolución año a año es justo lo que se quiere mirar); el
// desplegable solo decide qué se puede consultar, no qué existe.
//
// Lo que NO hace: preguntar a la base de datos. Sería lo exacto, pero son
// cinco selectores y una consulta cada uno para ahorrar como mucho unas
// opciones vacías — que además aquí se quieren.

// El año más antiguo que se puede consultar o rellenar. No es "cuándo
// empezó la academia": es hasta dónde se admite importar contabilidad
// anterior a la app.
export const PRIMER_ANIO = 2020;
const ANIOS_ATRAS = 6;

export function aniosDisponibles(anioActual = new Date().getFullYear()) {
  // El año actual entra SIEMPRE, aunque el reloj del ordenador esté mal
  // puesto y diga 2019: un selector vacío no deja trabajar.
  const desde = Math.min(anioActual, PRIMER_ANIO, anioActual - ANIOS_ATRAS);
  const anios = [];
  for (let a = desde; a <= anioActual; a += 1) anios.push(a);
  return anios;
}
