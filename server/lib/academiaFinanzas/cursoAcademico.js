// El curso académico va de septiembre a agosto — distinto del año fiscal
// (enero a diciembre, usado en resumen.routes.js para el Modelo 130).
// Dado cualquier (mes, anio), estas funciones devuelven el curso que lo
// contiene: si mes >= 9 el curso empieza ESE año; si mes <= 8 empezó el
// año anterior.

export function anioInicioCurso(mes, anio) {
  return mes >= 9 ? anio : anio - 1;
}

// Los 12 {mes, anio} del curso, en orden (septiembre primero).
export function mesesDelCurso(mes, anio) {
  const inicio = anioInicioCurso(mes, anio);
  const meses = [];
  for (let i = 0; i < 12; i += 1) {
    const m = ((9 - 1 + i) % 12) + 1; // 9,10,11,12,1,2,...,8
    const a = m >= 9 ? inicio : inicio + 1;
    meses.push({ mes: m, anio: a });
  }
  return meses;
}

export function claveMesAnio(mes, anio) {
  return `${anio}-${String(mes).padStart(2, "0")}`;
}
