// LOS CÓDIGOS DE SABER VÁLIDOS PARA UN ARCHIVO DE REFERENCIAS: los del
// currículo de Aragón de su curso. En 4.º ESO de Matemáticas hay dos
// materias con los mismos códigos (A y B, con saberes distintos detrás): si
// el archivo dice su `opcion`, solo cuentan los de esa.
//
// `curriculo` es lo que devuelve curriculoDeCurso(slug, curso).
export function listasDeSaberes(curriculo, opcion) {
  const listas = curriculo?.saberes || [];
  if (!opcion) return listas;
  const deLaOpcion = listas.filter((s) => new RegExp(`\\b${opcion}\\b`).test(s.etiqueta));
  return deLaOpcion.length ? deLaOpcion : listas;
}

export function apartadosDeSaberes(curriculo, opcion) {
  return listasDeSaberes(curriculo, opcion).flatMap((s) => s.bloques.flatMap((b) => b.apartados));
}

export function codigosDeSaberes(curriculo, opcion) {
  return new Set(apartadosDeSaberes(curriculo, opcion).map((a) => a.codigo));
}
