// LA SOLUCIÓN DE UN EJERCICIO DE TÉCNICA, ESCRITA POR EL CÓDIGO a partir de
// lo que ya se ha comprobado, no por la IA.
//
// En la primera prueba real (30/9) la IA escribió 8 ejercicios y se tiraron
// 3 enteros por UN apartado mal resuelto cada uno (su "respuesta" no era la
// de su ecuación). Tirar un ejercicio de seis apartados por uno es
// desperdiciar cinco buenos: ahora se quita ese apartado y la solución se
// rehace con las respuestas comprobadas, así que no puede contradecirlas.
const LETRAS = "abcdefghij";

// "9/11" → \frac{9}{11}; "3*x^2-2" → 3x^{2} - 2; "sqrt(5)" → \sqrt{5}.
export function latexDeTexto(texto) {
  let t = String(texto).trim().replace(/\*\*/g, "^");
  t = t.replace(/sqrt\(([^()]*)\)/g, "\\sqrt{$1}");
  t = t.replace(/^(-?)(\d+)\/(\d+)$/, "$1\\frac{$2}{$3}");
  t = t.replace(/\^(\d+|\([^()]*\))/g, (_, e) => `^{${e.replace(/^\(|\)$/g, "")}}`);
  t = t.replace(/(\d)\*([a-z(\\])/g, "$1$2").replace(/\*/g, " \\cdot ");
  return t.replace(/\./g, "{,}");
}

function textoDe(c) {
  const r = c.respuesta;
  if (typeof r === "string" && ["sin solución", "identidad", "infinitas"].includes(r)) return r;
  if (c.tipo === "ecuacion") return r.map((v) => `$${c.var || "x"} = ${latexDeTexto(v)}$`).join(", ");
  if (c.tipo === "sistema") return Object.entries(r).map(([k, v]) => `$${k} = ${latexDeTexto(v)}$`).join(", ");
  if (c.tipo === "estadistica" && Array.isArray(r)) return `moda ${r.join(", ")}`;
  return `$${latexDeTexto(r)}$`;
}

export function solucionDeApartados(comprobar) {
  return comprobar.map((c) => `${c.apartado ? `${c.apartado}) ` : ""}${textoDe(c)}`).join("; ");
}

// ¿Se puede rehacer? Solo si cada apartado tiene su comprobación con su
// letra (a, b, c… en orden), y nada más.
export function unaComprobacionPorApartado(e) {
  const n = e.apartados?.length || 0;
  if (!n || (e.comprobar || []).length !== n) return false;
  return e.comprobar.every((c, i) => c.apartado === LETRAS[i]);
}

// Quita los apartados de índice `malos` y vuelve a poner las letras.
export function sinApartados(e, malos) {
  const quedan = e.apartados.map((a, i) => [a, e.comprobar[i]]).filter((_, i) => !malos.has(i));
  return {
    ...e,
    apartados: quedan.map(([a]) => a),
    comprobar: quedan.map(([, c], i) => ({ ...c, apartado: LETRAS[i] })),
  };
}
