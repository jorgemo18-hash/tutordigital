import { criteriosDe, modoDeCalificacion } from "./estructuraDeLaProgramacion.js";

// CÓMO SE EVALÚA CADA CRITERIO: con qué instrumentos, y si es un
// aprendizaje imprescindible (el mínimo para aprobar).
//
// Es lo que tienen las programaciones reales y la nuestra no (comparación
// con la del IES Ramón y Cajal de Huesca, 24/9): por unidad, una tabla con
// Criterio | Ponderación | Imprescindible | Instrumentos. Se guarda POR
// CRITERIO y no por unidad, porque un criterio se evalúa igual aparezca en
// la unidad que aparezca; la tabla de cada unidad lo enseña con los suyos.
//
// En `datos.criterios`: { "1.1": { instrumentos: ["PE", "OB"], imprescindible: true } }.
export const INSTRUMENTOS = {
  PE: "Prueba escrita",
  PO: "Prueba oral",
  OB: "Observación sistemática",
  CU: "Cuaderno de clase",
  TR: "Trabajos y proyectos",
  AU: "Autoevaluación y coevaluación",
};
export const SIGLAS = Object.keys(INSTRUMENTOS);

export function fichaDeCriterio(datos, codigo) {
  const f = datos?.criterios?.[codigo] || {};
  return {
    instrumentos: (f.instrumentos || []).filter((s) => SIGLAS.includes(s)),
    imprescindible: Boolean(f.imprescindible),
  };
}

// El peso del criterio en la nota final (%). Por criterio, el suyo; por
// competencia, el de su competencia repartido a partes iguales entre sus
// criterios (es lo que dice el apartado d en ese modo).
export function pesoDeCriterio(curriculo, datos, codigo) {
  const pesos = datos?.pesos || {};
  if (modoDeCalificacion(datos) === "criterio") return Number(pesos[codigo]) || 0;
  const todos = criteriosDe(curriculo);
  const k = todos.find((x) => x.codigo === codigo);
  if (!k) return 0;
  const hermanos = todos.filter((x) => x.competencia === k.competencia).length || 1;
  return Math.round(((Number(pesos[k.competencia]) || 0) / hermanos) * 10) / 10;
}

// Cambia una ficha sin dejar basura: una ficha vacía no se guarda.
export function ponFicha(datos, codigo, cambio) {
  const actual = fichaDeCriterio(datos, codigo);
  const nueva = { ...actual, ...cambio };
  const criterios = { ...(datos.criterios || {}) };
  if (!nueva.instrumentos.length && !nueva.imprescindible) delete criterios[codigo];
  else criterios[codigo] = { instrumentos: SIGLAS.filter((s) => nueva.instrumentos.includes(s)), imprescindible: nueva.imprescindible };
  datos.criterios = criterios;
}

// Cuántos criterios tienen ya algún instrumento, para el aviso del editor y
// del documento.
export function criteriosSinInstrumento(curriculo, datos) {
  return criteriosDe(curriculo).filter((k) => !fichaDeCriterio(datos, k.codigo).instrumentos.length).map((k) => k.codigo);
}
