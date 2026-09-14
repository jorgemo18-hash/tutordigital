// EL BLOQUE DE ARRIBA: la fórmula, el esquema o el resumen.
//
// Jorge, el 14/09/2026: *"me gustan estos que te sale la fórmula o un esquema o
// resumen si es más teoría y debajo los ejercicios"*.
//
// Dos límites que son la razón de que esto sea un componente y no texto libre:
//
// - NO ES LA TEORÍA DEL TEMA, es lo que hace falta para hacer ESTOS ejercicios.
//   Si ocupa más de un cuarto de la hoja, el alumno lee y no hace, que es
//   justo lo contrario de lo que queremos.
// - LAS FÓRMULAS VAN ENMARCADAS Y APARTE, no dentro de un párrafo. Es lo que
//   distingue el cartel de progresiones que le gustó de una página de libro:
//   puedes buscar la fórmula sin leer nada.
//
// El texto puede llevar matemáticas entre $...$; las dibuja KaTeX después
// (formulasDeLaHoja.js). Aquí todo entra como texto, nunca como HTML.

const MAX_FORMULAS = 4;

function buildFormula({ tex = "", pie = "" }, doc) {
  const caja = doc.createElement("div");
  caja.className = "hj-formula";

  const cuerpo = doc.createElement("span");
  // Entre $...$ para que lo recoja la pasada de KaTeX. Si KaTeX no carga, se
  // ve el LaTeX en crudo: feo, pero legible y nunca en blanco.
  cuerpo.textContent = `$${tex}$`;
  caja.appendChild(cuerpo);

  if (pie) {
    const p = doc.createElement("span");
    p.className = "hj-formula-pie";
    p.textContent = pie;
    caja.appendChild(p);
  }
  return caja;
}

export function buildEsencial({
  titulo = "Lo esencial",
  parrafos = [],
  formulas = [],
  doc = globalThis.document,
} = {}) {
  if (!parrafos.length && !formulas.length) return null;

  const caja = doc.createElement("section");
  caja.className = "hj-esencial";

  const tit = doc.createElement("div");
  tit.className = "hj-esencial-titulo";
  tit.textContent = titulo;
  caja.appendChild(tit);

  parrafos.forEach((texto) => {
    const p = doc.createElement("p");
    p.textContent = texto;
    caja.appendChild(p);
  });

  // Más de cuatro fórmulas ya no es un recordatorio, es un formulario: se
  // corta aquí en vez de dejar que la caja se coma la hoja.
  const visibles = formulas.slice(0, MAX_FORMULAS);
  if (visibles.length) {
    const fila = doc.createElement("div");
    fila.className = "hj-formulas";
    visibles.forEach((f) => fila.appendChild(buildFormula(f, doc)));
    caja.appendChild(fila);
  }

  return caja;
}
