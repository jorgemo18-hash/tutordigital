import { OBJETIVOS, bateriasPropias } from "./catalogoDeBaterias.js";

// "TODO EL TEMA": UN EJERCICIO DE CADA OBJETIVO. Jorge, 23/9: *"que de lo
// que se pida haya de todos; si es todo el tema, que haya mínimo uno de cada
// uno"*, y eligió uno por objetivo (6 ejercicios, 1-2 folios): una hoja de
// repaso del tema. Uno por concepto serían 12, por encima del máximo de 10.
//
// De cada objetivo, uno al azar ENTRE LOS DE DIFICULTAD 1 Y 2: en una hoja
// de repaso de todo el tema, un ejercicio de dificultad 3 por objetivo sería
// una hoja de examen. "Volver a montar" da otra combinación. En el orden de
// los objetivos, que es la secuencia del tema.
export const DIFICULTAD_MAXIMA_DEL_TEMA = 2;

export function unaDeCadaObjetivo(azar, objetivos = OBJETIVOS) {
  const claves = [];
  for (const numero of objetivos) {
    const propias = bateriasPropias(numero);
    const asequibles = propias.filter((b) => b.dificultad <= DIFICULTAD_MAXIMA_DEL_TEMA);
    const elegida = azar.elige(asequibles.length ? asequibles : propias);
    if (elegida) claves.push(elegida.clave);
  }
  return claves;
}

export const TITULO_DEL_TEMA = "Repaso de todo el tema";
