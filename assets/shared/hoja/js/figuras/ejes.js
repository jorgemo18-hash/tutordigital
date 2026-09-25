import { el, texto, lienzo, mm, escribeNumero, esNumero, esPunto } from "./svg.js";

// LOS EJES CARTESIANOS con cuadrícula: para situar puntos, leer sus
// coordenadas y leer o dibujar una gráfica (funciones, D.5).
//
//   { tipo: "ejes", x: [-5, 5], y: [-4, 4],          // de cuánto a cuánto
//     pasoX: 1, pasoY: 1,                              // una marca cada…
//     rotulosCada: 1,                                  // números cada tantas marcas
//     nombres: { x: "Horas", y: "Km" },                // opcional
//     puntos: [{ x: 2, y: 3, etiqueta: "A" }],
//     lineas: [[[0, 0], [2, 60], [3, 60]]],            // gráficas: poligonales
//     vacia: false }                                   // true: solo cuadrícula (para dibujar)
//
// La cuadrícula mide 5 mm por paso: es la del cuaderno de cuadros, y el
// alumno puede contar cuadros para leer una coordenada.

const CUADRO = 5;
const MARGEN = { izq: 8, der: 5, arr: 5, aba: 7 };
// Con nombres en los ejes hace falta sitio fuera de la cuadrícula para
// ellos: si van dentro, la gráfica los tacha.
const CON_NOMBRES = { der: 16, arr: 8 };
export const MAX_PASOS = 24;

function marcas([a, b], paso) {
  if (![a, b, paso].every(esNumero) || paso <= 0 || b <= a) return null;
  const n = Math.round((b - a) / paso);
  if (n < 1 || n > MAX_PASOS || Math.abs(a + n * paso - b) > 1e-9) return null;
  return Array.from({ length: n + 1 }, (_, i) => a + i * paso);
}

export function buildEjes(figura, doc = globalThis.document) {
  const pasoX = figura?.pasoX ?? 1;
  const pasoY = figura?.pasoY ?? 1;
  const mx = marcas(figura?.x || [], pasoX);
  const my = marcas(figura?.y || [], pasoY);
  if (!mx || !my) return null;
  const puntos = figura.puntos || [];
  const lineas = figura.lineas || [];
  if (!puntos.every((p) => esNumero(p?.x) && esNumero(p?.y))) return null;
  if (!lineas.every((l) => Array.isArray(l) && l.length >= 2 && l.every(esPunto))) return null;

  const [x0, x1] = figura.x;
  const [y0, y1] = figura.y;
  const m = figura.nombres ? { ...MARGEN, ...CON_NOMBRES } : MARGEN;
  const ancho = m.izq + (mx.length - 1) * CUADRO + m.der;
  const alto = m.arr + (my.length - 1) * CUADRO + m.aba;
  const X = (v) => m.izq + ((v - x0) / pasoX) * CUADRO;
  const Y = (v) => m.arr + ((y1 - v) / pasoY) * CUADRO;
  const svg = lienzo(doc, { ancho, alto, clase: "hj-ejes", descripcion: figura.descripcion || "Ejes de coordenadas" });

  // La cuadrícula, fina y gris: en fotocopia se ve, pero no compite con los
  // ejes ni con la gráfica.
  mx.forEach((v) => svg.appendChild(el(doc, "line", { x1: mm(X(v)), y1: mm(Y(y0)), x2: mm(X(v)), y2: mm(Y(y1)), class: "hj-ejes-cuadricula" })));
  my.forEach((v) => svg.appendChild(el(doc, "line", { x1: mm(X(x0)), y1: mm(Y(v)), x2: mm(X(x1)), y2: mm(Y(v)), class: "hj-ejes-cuadricula" })));

  // Los ejes, donde está el 0 (o en el borde si el 0 no está a la vista).
  const ex = y0 <= 0 && 0 <= y1 ? Y(0) : Y(y0);
  const ey = x0 <= 0 && 0 <= x1 ? X(0) : X(x0);
  svg.appendChild(el(doc, "line", { x1: mm(X(x0)), y1: mm(ex), x2: mm(X(x1) + 2), y2: mm(ex), class: "hj-ejes-eje" }));
  svg.appendChild(el(doc, "line", { x1: mm(ey), y1: mm(Y(y0)), x2: mm(ey), y2: mm(Y(y1) - 2), class: "hj-ejes-eje" }));
  svg.appendChild(el(doc, "path", { d: `M${mm(X(x1) + 2)} ${mm(ex)} l-1.6 -0.9 M${mm(X(x1) + 2)} ${mm(ex)} l-1.6 0.9 M${mm(ey)} ${mm(Y(y1) - 2)} l-0.9 1.6 M${mm(ey)} ${mm(Y(y1) - 2)} l0.9 1.6`, class: "hj-ejes-eje" }));

  const cada = figura.rotulosCada ?? 1;
  mx.forEach((v, i) => { if (v !== 0 && i % cada === 0) svg.appendChild(texto(doc, X(v), ex + 3.4, escribeNumero(v), "hj-ejes-rotulo")); });
  my.forEach((v, i) => { if (v !== 0 && i % cada === 0) svg.appendChild(texto(doc, ey - 1.2, Y(v) + 1, escribeNumero(v), "hj-ejes-rotulo", "end")); });
  // El 0, abajo a la derecha del origen: a la izquierda chocaba con el −1.
  if ((x0 <= 0 && 0 <= x1) && (y0 <= 0 && 0 <= y1)) svg.appendChild(texto(doc, ey + 1, ex + 3.4, "0", "hj-ejes-rotulo", "start"));
  // Los nombres, FUERA de la cuadrícula: el de x detrás de la flecha y el de
  // y encima de la suya.
  if (figura.nombres?.x) svg.appendChild(texto(doc, X(x1) + 3.4, ex + 1, figura.nombres.x, "hj-ejes-nombre", "start"));
  if (figura.nombres?.y) svg.appendChild(texto(doc, ey, Y(y1) - 3.4, figura.nombres.y, "hj-ejes-nombre"));

  if (!figura.vacia) {
    lineas.forEach((l) => svg.appendChild(el(doc, "polyline", { points: l.map(([a, b]) => `${mm(X(a))},${mm(Y(b))}`).join(" "), class: "hj-ejes-grafica" })));
    puntos.forEach((p) => {
      svg.appendChild(el(doc, "circle", { cx: mm(X(p.x)), cy: mm(Y(p.y)), r: 0.8, class: "hj-ejes-punto" }));
      // La letra, arriba a la derecha del punto; si ahí cae la fila de
      // números del eje x (un punto justo debajo del eje), va debajo.
      const arriba = Y(p.y) - 1.2;
      const enLaFila = arriba > ex && arriba < ex + 4.6;
      if (p.etiqueta) svg.appendChild(texto(doc, X(p.x) + 1.4, enLaFila ? Y(p.y) + 3.4 : arriba, p.etiqueta, "hj-ejes-etiqueta", "start"));
    });
  }
  return svg;
}
