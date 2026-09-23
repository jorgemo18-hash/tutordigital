// LOS TÍTULOS DE BLOQUE: dónde cambia de objetivo la hoja.
//
// Vive en assets/ y no en el montador porque lo usan los dos lados: el
// montador al armar la hoja, y el panel cuando el profesor cambia o quita un
// ejercicio suelto (sections/ejercicios/). Si cada uno tuviera su regla, una
// hoja retocada en el panel titularía distinto que la misma hoja recién
// montada.
//
// La regla y su porqué (Jorge, 18/9) están en montadorDeHoja.js: el título va
// SOLO en la primera actividad de cada bloque, la numeración sigue corrida, y
// con un solo objetivo no se titula nada.
//
// Se recalcula desde cero: los títulos que traigan las actividades se tiran
// primero. Así, quitar la primera actividad de un bloque pasa el título a la
// siguiente, en vez de dejar el bloque sin título.
export function conTitulosDeBloque(actividades, objetivos, tituloDe) {
  const limpias = actividades.map(({ bloque, ...resto }) => resto);
  if (new Set(objetivos).size < 2) return limpias;

  let anterior = null;
  return limpias.map((actividad, i) => {
    const objetivo = objetivos[i];
    if (objetivo === anterior) return actividad;
    anterior = objetivo;
    const titulo = tituloDe(objetivo);
    return titulo ? { ...actividad, bloque: titulo } : actividad;
  });
}
