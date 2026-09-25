import { el, texto, lienzo, mm, esNumero, esPunto } from "./svg.js";

// UN DIBUJO GEOMÉTRICO: polígonos, segmentos, circunferencias, cotas y
// ángulos, dibujados por nuestro código a partir de números.
//
// Por qué así y no un dibujo del modelo: ver rectaNumerica.js. Una figura
// mal dibujada es un fallo de código, que se arregla una vez.
//
// LA FIGURA ES UN DATO, en unidades del problema (centímetros, metros: da
// igual), y este archivo la escala para que quepa en la caja:
//
//   { tipo: "geometria",
//     elementos: [
//       { poligono: [[0,0], [7,0], [7,4], [0,4]] },
//       { segmento: [[2,0], [2,4]], discontinuo: true },   // una altura
//       { circulo: { centro: [0,0], radio: 3 } },
//       { cota: { de: [0,0], a: [7,0], texto: "7 cm", lado: -1 } },
//       { angulo: { vertice: [0,0], desde: [7,0], hasta: [0,4], texto: "90°", recto: true } },
//       { etiqueta: { en: [3.5, 2], texto: "A" } },
//       { punto: [0,0] },
//     ],
//     escala: "proporcional" }   // o "real": 1 unidad = 1 mm (para medir)
//
// Con escala "real" la figura se imprime a su tamaño (un ángulo de 40° mide
// 40° con el transportador; un segmento de 5 cm mide 5 cm con la regla). Es
// lo que permite «medición directa de ángulos» (B.2) en papel.

export const CAJA = { ancho: 70, alto: 42 };
const MARGEN = 7;

// Todas las coordenadas del dibujo, para calcular la caja que ocupa.
function puntosDe(elementos) {
  const ps = [];
  for (const e of elementos) {
    if (e.poligono) ps.push(...e.poligono);
    if (e.segmento) ps.push(...e.segmento);
    if (e.punto) ps.push(e.punto);
    if (e.circulo) {
      const { centro: [cx, cy], radio: r } = e.circulo;
      ps.push([cx - r, cy - r], [cx + r, cy + r]);
    }
    if (e.cota) ps.push(e.cota.de, e.cota.a);
    if (e.angulo) ps.push(e.angulo.vertice);
    if (e.etiqueta) ps.push(e.etiqueta.en);
  }
  return ps;
}

// Un elemento con datos que no se pueden dibujar invalida TODA la figura:
// mejor sin dibujo que con uno a medias.
function valido(e) {
  if (e.poligono) return Array.isArray(e.poligono) && e.poligono.length >= 3 && e.poligono.every(esPunto);
  if (e.segmento) return Array.isArray(e.segmento) && e.segmento.length === 2 && e.segmento.every(esPunto);
  if (e.circulo) return esPunto(e.circulo.centro) && esNumero(e.circulo.radio) && e.circulo.radio > 0;
  if (e.cota) return esPunto(e.cota.de) && esPunto(e.cota.a) && typeof e.cota.texto === "string";
  if (e.angulo) return esPunto(e.angulo.vertice) && esPunto(e.angulo.desde) && esPunto(e.angulo.hasta);
  if (e.etiqueta) return esPunto(e.etiqueta.en) && typeof e.etiqueta.texto === "string";
  if (e.punto) return esPunto(e.punto);
  return false;
}

// La transformación de unidades del problema a mm del folio. El eje y del
// problema va hacia ARRIBA (como en matemáticas) y el del SVG hacia abajo.
export function transformacion(figura) {
  const elementos = figura?.elementos;
  if (!Array.isArray(elementos) || !elementos.length || !elementos.every(valido)) return null;
  const ps = puntosDe(elementos);
  const xs = ps.map((p) => p[0]);
  const ys = ps.map((p) => p[1]);
  const [x0, x1, y0, y1] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)];
  const [w, h] = [x1 - x0, y1 - y0];
  if (w <= 0 && h <= 0) return null;
  const real = figura.escala === "real";
  const k = real ? 1 : Math.min((CAJA.ancho - 2 * MARGEN) / (w || 1), (CAJA.alto - 2 * MARGEN) / (h || 1));
  const ancho = w * k + 2 * MARGEN;
  const alto = h * k + 2 * MARGEN;
  const f = ([x, y]) => [MARGEN + (x - x0) * k, MARGEN + (y1 - y) * k];
  return { f, k, ancho, alto };
}

const pts = (lista, f) => lista.map((p) => f(p).map(mm).join(",")).join(" ");

// La cota: una línea paralela al lado, separada 3 mm hacia `lado` (+1: a
// la izquierda del sentido de→a; −1: a la derecha), con topes y el texto en
// medio.
function cota(doc, { de, a, texto: t, lado = 1 }, f) {
  const [p, q] = [f(de), f(a)];
  const [dx, dy] = [q[0] - p[0], q[1] - p[1]];
  const largo = Math.hypot(dx, dy) || 1;
  // Normal en coordenadas del SVG (y hacia abajo).
  const [nx, ny] = [(dy / largo) * lado, (-dx / largo) * lado];
  const s = 3;
  const [a1, a2] = [[p[0] + nx * s, p[1] + ny * s], [q[0] + nx * s, q[1] + ny * s]];
  const g = el(doc, "g", { class: "hj-geo-cota" });
  g.appendChild(el(doc, "line", { x1: mm(a1[0]), y1: mm(a1[1]), x2: mm(a2[0]), y2: mm(a2[1]) }));
  for (const [b, c] of [[p, a1], [q, a2]]) {
    g.appendChild(el(doc, "line", { x1: mm(b[0] + nx * 1), y1: mm(b[1] + ny * 1), x2: mm(c[0] + nx * 0.8), y2: mm(c[1] + ny * 0.8) }));
  }
  // El texto, fuera de la línea de cota: en una cota vertical, al lado y
  // alineado hacia fuera (si se centrara, la línea lo tacharía).
  const vertical = Math.abs(nx) > Math.abs(ny);
  const c = [(a1[0] + a2[0]) / 2, (a1[1] + a2[1]) / 2];
  if (vertical) g.appendChild(texto(doc, c[0] + nx * 1.4, c[1] + 1, t, "hj-geo-texto", nx > 0 ? "start" : "end"));
  else g.appendChild(texto(doc, c[0], c[1] + ny * 2.4 + 1, t, "hj-geo-texto"));
  return g;
}

// El ángulo: un arco de 5 mm de radio (o el cuadradito del recto) y el
// texto en la bisectriz.
function angulo(doc, { vertice, desde, hasta, texto: t, recto }, f) {
  const v = f(vertice);
  const dir = (p) => { const q = f(p); const d = Math.hypot(q[0] - v[0], q[1] - v[1]) || 1; return [(q[0] - v[0]) / d, (q[1] - v[1]) / d]; };
  const [u, w] = [dir(desde), dir(hasta)];
  const g = el(doc, "g", { class: "hj-geo-angulo" });
  const r = 5;
  if (recto) {
    const s = 2.5;
    const [a, b, c] = [[v[0] + u[0] * s, v[1] + u[1] * s], [v[0] + (u[0] + w[0]) * s, v[1] + (u[1] + w[1]) * s], [v[0] + w[0] * s, v[1] + w[1] * s]];
    g.appendChild(el(doc, "polyline", { points: [a, b, c].map((p) => p.map(mm).join(",")).join(" ") }));
  } else {
    const [a, b] = [[v[0] + u[0] * r, v[1] + u[1] * r], [v[0] + w[0] * r, v[1] + w[1] * r]];
    // El arco va por el lado del ángulo menor (< 180°).
    const cruz = u[0] * w[1] - u[1] * w[0];
    g.appendChild(el(doc, "path", { d: `M${mm(a[0])} ${mm(a[1])} A${r} ${r} 0 0 ${cruz > 0 ? 1 : 0} ${mm(b[0])} ${mm(b[1])}` }));
  }
  if (t) {
    const bis = [u[0] + w[0], u[1] + w[1]];
    const d = Math.hypot(...bis) || 1;
    const lejos = r + 3.6;
    g.appendChild(texto(doc, v[0] + (bis[0] / d) * lejos, v[1] + (bis[1] / d) * lejos + 1, t, "hj-geo-texto"));
  }
  return g;
}

export function buildGeometria(figura, doc = globalThis.document) {
  const tr = transformacion(figura);
  if (!tr) return null;
  const { f, k, ancho, alto } = tr;
  const svg = lienzo(doc, { ancho, alto, clase: "hj-geo", descripcion: figura.descripcion || "Figura geométrica" });
  for (const e of figura.elementos) {
    if (e.poligono) svg.appendChild(el(doc, "polygon", { points: pts(e.poligono, f), class: "hj-geo-linea" }));
    if (e.segmento) {
      const [p, q] = e.segmento.map(f);
      svg.appendChild(el(doc, "line", { x1: mm(p[0]), y1: mm(p[1]), x2: mm(q[0]), y2: mm(q[1]), class: e.discontinuo ? "hj-geo-linea hj-geo-discontinua" : "hj-geo-linea" }));
    }
    if (e.circulo) {
      const c = f(e.circulo.centro);
      svg.appendChild(el(doc, "circle", { cx: mm(c[0]), cy: mm(c[1]), r: mm(e.circulo.radio * k), class: "hj-geo-linea" }));
    }
    if (e.punto) {
      const c = f(e.punto);
      svg.appendChild(el(doc, "circle", { cx: mm(c[0]), cy: mm(c[1]), r: 0.6, class: "hj-geo-punto" }));
    }
    if (e.cota) svg.appendChild(cota(doc, e.cota, f));
    if (e.angulo) svg.appendChild(angulo(doc, e.angulo, f));
    if (e.etiqueta) {
      const [x, y] = f(e.etiqueta.en);
      svg.appendChild(texto(doc, x, y + 1, e.etiqueta.texto, "hj-geo-texto hj-geo-etiqueta"));
    }
  }
  return svg;
}
