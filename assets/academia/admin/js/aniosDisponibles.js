// Qué años se pueden elegir en los selectores de período (Ingresos, Gastos,
// Resumen, Fiscal y Envío a familias).
//
// EL FALLO QUE ARREGLA. Los cinco selectores repetían
// `for (let a = 2024; a <= anioActual + 2; a++)`. En 2026 eso ofrecía
// 2024-2028: cinco años, sí, pero dos de ellos en el futuro. No existe un
// recibo de 2028 ni un gasto de 2027 — elegir esos años solo lleva a una
// pantalla vacía y a preguntarse si se ha roto algo.
//
// LA REGLA. Del año actual hacia atrás, nunca hacia delante. Y sin bajar de
// 2024, que es el primer año que puede tener datos: enseñar 2021 con cero
// euros no es "más historial", es una opción que no lleva a ninguna parte.
// Hoy (2026) son tres años; en 2028 serán los cinco.
//
// Lo que NO hace: preguntar a la base de datos desde cuándo tiene datos ESTE
// centro. Sería lo exacto, pero son cinco selectores y una consulta cada uno
// para ahorrar como mucho un par de opciones vacías. Si algún día una
// academia empieza en 2029 y ve cinco años muertos, ese es el momento.

export const PRIMER_ANIO = 2024;
const ANIOS_ATRAS = 4;

export function aniosDisponibles(anioActual = new Date().getFullYear()) {
  // El año actual entra SIEMPRE, aunque el reloj del ordenador esté mal
  // puesto y diga 2019: un selector vacío no deja trabajar.
  const desde = Math.min(anioActual, Math.max(PRIMER_ANIO, anioActual - ANIOS_ATRAS));
  const anios = [];
  for (let a = desde; a <= anioActual; a += 1) anios.push(a);
  return anios;
}
