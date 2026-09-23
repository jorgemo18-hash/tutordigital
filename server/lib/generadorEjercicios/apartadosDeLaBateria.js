// CUÁNTOS APARTADOS SE LE PIDEN A UNA BATERÍA.
//
// Está en su propio archivo porque lo necesitan dos sitios que no se conocen:
// el montador, al armar la hoja, y el script de calibración, al medir cuánto
// ocupa cada batería. Si la calibración midiera con otros números que los que
// usa el montador, la tabla de alturas describiría hojas que nadie imprime.

// El orden es de menos a más, y se usa como tal: los tres modos son los tres
// tamaños de la misma batería.
export const MODOS_DE_APARTADOS = ["minimo", "medio", "maximo"];

// NUNCA POR DEBAJO DEL MÍNIMO. Ese número está en la instrucción del
// arquetipo sembrado ("de 6 a 9 apartados") y bajarlo rompe lo que la batería
// pretende cubrir: los cuatro casos de signos no caben en tres apartados.
export function apartadosDe(bateria, modo) {
  if (modo === "minimo") return bateria.minimo;
  if (modo === "maximo") return bateria.maximo;
  return Math.round((bateria.minimo + bateria.maximo) / 2);
}
