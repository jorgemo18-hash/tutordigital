import { el, texto, lienzo, mm, escribeNumero, esNumero } from "./svg.js";

// LOS GRÁFICOS ESTADÍSTICOS: barras y sectores (E.1, «análisis e
// interpretación de tablas y gráficos estadísticos»).
//
//   { tipo: "barras", categorias: ["Fútbol", "Baloncesto"], valores: [8, 5],
//     paso: 2, nombreY: "Alumnos" }
//   { tipo: "sectores", partes: [{ etiqueta: "Fútbol", valor: 8 }, …] }
//
// EN BLANCO Y NEGRO: las barras son todas iguales (grises con borde), la
// categoría va debajo y el valor se lee en el eje con una cuadrícula; los
// sectores llevan su etiqueta FUERA, junto a cada porción, porque en
// fotocopia los colores de una leyenda no se distinguen.

const ANCHO_BARRA = 7;
const HUECO = 4;
const ALTO_UTIL = 36;
const MARGEN = { izq: 10, der: 4, arr: 5, aba: 7 };

export function buildBarras(figura, doc = globalThis.document) {
  const { categorias, valores } = figura || {};
  const paso = figura?.paso ?? 1;
  if (!Array.isArray(categorias) || !Array.isArray(valores) || categorias.length !== valores.length) return null;
  if (categorias.length < 2 || categorias.length > 10 || !valores.every((v) => esNumero(v) && v >= 0)) return null;
  if (!esNumero(paso) || paso <= 0) return null;
  const max = Math.ceil(Math.max(...valores) / paso) * paso || paso;
  const marcas = Math.round(max / paso);
  if (marcas > 15) return null;

  // Cada barra ocupa lo que su nombre más largo (a 1,5 mm por letra, el
  // cuerpo de 3 px): "Baloncesto" no cabe en 11 mm y pisaba al vecino.
  const largo = Math.max(...categorias.map((c) => String(c).length));
  const hueco = Math.max(HUECO, largo * 1.5 + 1.5 - ANCHO_BARRA);
  const ancho = MARGEN.izq + categorias.length * (ANCHO_BARRA + hueco) + hueco + MARGEN.der;
  const alto = MARGEN.arr + ALTO_UTIL + MARGEN.aba;
  const Y = (v) => MARGEN.arr + ALTO_UTIL * (1 - v / max);
  const svg = lienzo(doc, { ancho, alto, clase: "hj-barras", descripcion: figura.descripcion || "Diagrama de barras" });

  for (let i = 0; i <= marcas; i += 1) {
    const v = i * paso;
    svg.appendChild(el(doc, "line", { x1: MARGEN.izq, y1: mm(Y(v)), x2: mm(ancho - MARGEN.der), y2: mm(Y(v)), class: "hj-ejes-cuadricula" }));
    svg.appendChild(texto(doc, MARGEN.izq - 1.2, Y(v) + 1, escribeNumero(v), "hj-ejes-rotulo", "end"));
  }
  categorias.forEach((c, i) => {
    const x = MARGEN.izq + hueco + i * (ANCHO_BARRA + hueco);
    svg.appendChild(el(doc, "rect", { x: mm(x), y: mm(Y(valores[i])), width: ANCHO_BARRA, height: mm(Y(0) - Y(valores[i])), class: "hj-barras-barra" }));
    svg.appendChild(texto(doc, x + ANCHO_BARRA / 2, Y(0) + 3.6, c, "hj-ejes-rotulo"));
  });
  svg.appendChild(el(doc, "line", { x1: MARGEN.izq, y1: mm(Y(0)), x2: mm(ancho - MARGEN.der), y2: mm(Y(0)), class: "hj-ejes-eje" }));
  svg.appendChild(el(doc, "line", { x1: MARGEN.izq, y1: mm(Y(0)), x2: MARGEN.izq, y2: mm(Y(max) - 2), class: "hj-ejes-eje" }));
  if (figura.nombreY) svg.appendChild(texto(doc, MARGEN.izq + 1.4, MARGEN.arr - 1.4, figura.nombreY, "hj-ejes-nombre", "start"));
  return svg;
}

const R = 16;

export function buildSectores(figura, doc = globalThis.document) {
  const partes = figura?.partes;
  if (!Array.isArray(partes) || partes.length < 2 || partes.length > 7) return null;
  if (!partes.every((p) => typeof p?.etiqueta === "string" && esNumero(p.valor) && p.valor > 0)) return null;
  const total = partes.reduce((s, p) => s + p.valor, 0);
  const ancho = 2 * R + 44;
  const alto = 2 * R + 10;
  const [cx, cy] = [ancho / 2, alto / 2];
  const svg = lienzo(doc, { ancho, alto, clase: "hj-sectores", descripcion: figura.descripcion || "Diagrama de sectores" });
  svg.appendChild(el(doc, "circle", { cx: mm(cx), cy: mm(cy), r: R, class: "hj-sectores-borde" }));
  // Desde las doce, en el sentido de las agujas del reloj.
  let a = -Math.PI / 2;
  for (const p of partes) {
    const b = a + (p.valor / total) * 2 * Math.PI;
    svg.appendChild(el(doc, "line", { x1: mm(cx), y1: mm(cy), x2: mm(cx + R * Math.cos(a)), y2: mm(cy + R * Math.sin(a)), class: "hj-sectores-radio" }));
    const m = (a + b) / 2;
    const derecha = Math.cos(m) >= 0;
    svg.appendChild(texto(doc, cx + (R + 2.2) * Math.cos(m), cy + (R + 2.2) * Math.sin(m) + 1, p.etiqueta, "hj-ejes-rotulo", derecha ? "start" : "end"));
    a = b;
  }
  return svg;
}
