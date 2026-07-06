// Rangos de fecha compartidos por gastosConsultas.js y resumenConsultas.js
// — antes rangoMes vivía duplicado solo en gastosConsultas.js.
const MESES_TRIMESTRE = { 1: [1, 2, 3], 2: [4, 5, 6], 3: [7, 8, 9], 4: [10, 11, 12] };

export function mesesDelTrimestre(trimestre) {
  return MESES_TRIMESTRE[trimestre];
}

export function rangoMes(mes, anio) {
  const inicio = `${anio}-${String(mes).padStart(2, "0")}-01`;
  const finMes = new Date(anio, mes, 0).getDate();
  const fin = `${anio}-${String(mes).padStart(2, "0")}-${String(finMes).padStart(2, "0")}`;
  return { inicio, fin };
}

export function rangoTrimestre(trimestre, anio) {
  const meses = mesesDelTrimestre(trimestre);
  return { inicio: rangoMes(meses[0], anio).inicio, fin: rangoMes(meses[meses.length - 1], anio).fin };
}

export function rangoAnio(anio) {
  return { inicio: `${anio}-01-01`, fin: `${anio}-12-31` };
}
