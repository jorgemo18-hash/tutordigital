// LA MARCA DE DIFICULTAD DE UN EJERCICIO: tres puntos, los que "tocan"
// rellenos. Copiado de los circulitos que Anaya pone junto al número de cada
// ejercicio, que es lo único de esas páginas que ordena la hoja para el que la
// monta.
//
// Se queda en 1..3 A PROPÓSITO. Con cinco niveles nadie distingue el 3 del 4 y
// acabas etiquetando a ojo; con tres es "de clase", "de examen" y "para el que
// va sobrado". Y como luego esto lo va a rellenar un modelo, cuantos menos
// niveles haya, menos se equivoca.

export const DIFICULTAD_MIN = 1;
export const DIFICULTAD_MAX = 3;

export function normalizarDificultad(valor) {
  const n = Math.round(Number(valor));
  if (!Number.isFinite(n)) return DIFICULTAD_MIN;
  return Math.min(DIFICULTAD_MAX, Math.max(DIFICULTAD_MIN, n));
}

const TEXTO = {
  1: "Dificultad baja",
  2: "Dificultad media",
  3: "Dificultad alta",
};

export function textoDificultad(valor) {
  return TEXTO[normalizarDificultad(valor)];
}

export function buildDificultad(valor, doc = globalThis.document) {
  const nivel = normalizarDificultad(valor);
  const wrap = doc.createElement("span");
  wrap.className = "hj-act-dif";
  // El título es para la pantalla; en papel no se ve nada de esto, así que la
  // marca tiene que ser legible por sí sola.
  wrap.title = textoDificultad(nivel);
  for (let i = DIFICULTAD_MIN; i <= DIFICULTAD_MAX; i += 1) {
    const punto = doc.createElement("i");
    punto.className = i <= nivel ? "hj-dif-punto hj-dif-punto--on" : "hj-dif-punto";
    wrap.appendChild(punto);
  }
  return wrap;
}
