import { conTitulosDeBloque } from "../hoja/js/titulosDeBloque.js";

// LA HOJA MIENTRAS SE RETOCA: el contenido que se pinta y, en paralelo, qué
// batería hay en cada hueco. Operaciones puras (devuelven una hoja nueva, no
// tocan la que reciben) para poder probarlas sin pantalla.
//
// Cambiar o quitar un ejercicio recalcula los títulos de bloque con la MISMA
// regla que el montador (titulosDeBloque.js): si se quita el primero de un
// bloque, el título pasa al siguiente.

function conTitulos(estado, tituloDe) {
  return {
    ...estado,
    hoja: {
      ...estado.hoja,
      actividades: conTitulosDeBloque(estado.hoja.actividades, estado.huecos.map((h) => h.objetivo), tituloDe),
    },
  };
}

export function reemplazaActividad(estado, indice, { actividad, hueco }, tituloDe) {
  const actividades = estado.hoja.actividades.map((a, i) => (i === indice ? actividad : a));
  const huecos = estado.huecos.map((h, i) => (i === indice ? { ...hueco, orden: h.orden } : h));
  return conTitulos({ ...estado, hoja: { ...estado.hoja, actividades }, huecos }, tituloDe);
}

// Una hoja sin ejercicios no es una hoja: el último no se quita.
export function quitaActividad(estado, indice, tituloDe) {
  if (estado.hoja.actividades.length <= 1) return estado;
  const actividades = estado.hoja.actividades.filter((_, i) => i !== indice);
  const huecos = estado.huecos.filter((_, i) => i !== indice).map((h, i) => ({ ...h, orden: i + 1 }));
  return conTitulos({ ...estado, hoja: { ...estado.hoja, actividades }, huecos }, tituloDe);
}
