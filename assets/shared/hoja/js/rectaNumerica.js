// LA RECTA NUMÉRICA, dibujada por nuestro código.
//
// La migración 120 dejó los ejercicios de la recta FUERA de la generación
// automática por una razón que sigue siendo cierta: un modelo no dibuja una
// recta de forma fiable (marcas desiguales, el 0 corrido, puntos entre dos
// marcas). La salida que se decidió allí es esta: el contenido solo describe
// la recta con números —de dónde a dónde, de cuánto en cuánto, qué marcas van
// rotuladas y qué puntos se señalan— y el dibujo lo hace este archivo. Así
// una recta mal dibujada es un fallo de código, que se arregla una vez, y no
// de contenido, que habría que revisar hoja por hoja.
//
// LA FIGURA ES UN DATO:
//
//   { tipo: "recta", desde: -10, hasta: 10, paso: 1,
//     rotulos: [0, 1],                      // marcas con su número debajo
//     puntos: [{ valor: -3, etiqueta: "A" }] }  // puntos señalados encima
//
// Se construye con nodos (createElementNS), nunca con innerHTML, por lo mismo
// que los huecos (ver huecos.js): lo que llega aquí puede venir de un modelo.

const SVG = "http://www.w3.org/2000/svg";

// Unidades del dibujo = milímetros del folio. El ancho cabe en la columna de
// un apartado (unos 170 mm) con aire a la derecha.
export const ANCHO_MM = 150;
export const ALTO_MM = 15;
const MARGEN = 7;
const Y_LINEA = 8.5;

// Más marcas que esto no se leen en 150 mm: con 41 quedan a 3,4 mm y los
// números de debajo se pisan. El contenido no debería pedirlas nunca, pero si
// lo hace la figura no se dibuja antes que dibujarse ilegible.
export const MAX_MARCAS = 41;

// El signo menos tipográfico, no el guion: en un folio impreso "-3" con guion
// se lee como un trazo suelto delante del número.
export function escribeValor(v) {
  return v < 0 ? `−${-v}` : String(v);
}

// Valida la figura y devuelve las marcas, o null si no se puede dibujar.
export function marcasDe(figura) {
  const { desde, hasta, paso } = figura || {};
  if (![desde, hasta, paso].every(Number.isFinite)) return null;
  if (paso <= 0 || hasta <= desde) return null;
  const n = Math.round((hasta - desde) / paso) + 1;
  if (n < 2 || n > MAX_MARCAS) return null;
  return Array.from({ length: n }, (_, i) => desde + i * paso);
}

// Coordenadas con dos decimales: más no se ve y el SVG sale más limpio.
const mm = (n) => Math.round(n * 100) / 100;

function el(doc, nombre, atributos) {
  const nodo = doc.createElementNS(SVG, nombre);
  Object.entries(atributos).forEach(([k, v]) => nodo.setAttribute(k, String(v)));
  return nodo;
}

function texto(doc, x, y, contenido, clase) {
  const t = el(doc, "text", { x: mm(x), y, "text-anchor": "middle", class: clase });
  t.textContent = contenido;
  return t;
}

export function buildRecta(figura, doc = globalThis.document) {
  const marcas = marcasDe(figura);
  if (!marcas) return null;
  const { desde, hasta } = figura;
  const util = ANCHO_MM - 2 * MARGEN;
  const x = (v) => MARGEN + ((v - desde) / (hasta - desde)) * util;

  const svg = el(doc, "svg", {
    class: "hj-recta",
    viewBox: `0 0 ${ANCHO_MM} ${ALTO_MM}`,
    role: "img",
    "aria-label": `Recta numérica de ${desde} a ${hasta}`,
  });

  // La línea sobresale por los dos lados y acaba en flecha en los dos: la
  // recta sigue, no se termina en la última marca. Sin las flechas parece un
  // segmento y hay alumnos que creen que no hay números más allá.
  svg.appendChild(el(doc, "line", {
    x1: 1.5, y1: Y_LINEA, x2: ANCHO_MM - 1.5, y2: Y_LINEA, class: "hj-recta-linea",
  }));
  svg.appendChild(el(doc, "path", {
    d: `M1.5 ${Y_LINEA} l2.2 -1.2 M1.5 ${Y_LINEA} l2.2 1.2 `
      + `M${ANCHO_MM - 1.5} ${Y_LINEA} l-2.2 -1.2 M${ANCHO_MM - 1.5} ${Y_LINEA} l-2.2 1.2`,
    class: "hj-recta-linea",
  }));

  // EL 0 LLEVA UNA MARCA MÁS LARGA. Es la referencia de todo el ejercicio
  // ("a la izquierda del cero"), y así se encuentra de un vistazo aunque no
  // esté rotulado.
  marcas.forEach((v) => {
    const alto = v === 0 ? 2.2 : 1.4;
    svg.appendChild(el(doc, "line", {
      x1: mm(x(v)), y1: Y_LINEA - alto, x2: mm(x(v)), y2: Y_LINEA + alto,
      class: "hj-recta-marca",
    }));
  });

  const enRecta = new Set(marcas);
  (figura.rotulos || []).filter((v) => enRecta.has(v)).forEach((v) => {
    svg.appendChild(texto(doc, x(v), ALTO_MM - 0.8, escribeValor(v), "hj-recta-rotulo"));
  });

  // Un punto que no cae en una marca no se dibuja: en estos ejercicios todos
  // los puntos son enteros de la escala, y uno "entre marcas" sería un error
  // del contenido que en papel parecería una trampa.
  (figura.puntos || []).filter((p) => enRecta.has(p?.valor)).forEach((p) => {
    svg.appendChild(el(doc, "circle", {
      cx: mm(x(p.valor)), cy: Y_LINEA, r: 0.9, class: "hj-recta-punto",
    }));
    const etiqueta = p.etiqueta ?? escribeValor(p.valor);
    svg.appendChild(texto(doc, x(p.valor), Y_LINEA - 3.2, etiqueta, "hj-recta-etiqueta"));
  });

  return svg;
}
