// LO COMÚN A TODAS LAS FIGURAS DE LA HOJA: crear nodos SVG y escribir
// números.
//
// Las figuras se construyen con nodos (createElementNS), nunca con
// innerHTML, por lo mismo que los huecos (ver ../huecos.js): el dato puede
// venir de fuera. Y miden en MILÍMETROS: una unidad del viewBox es 1 mm del
// folio, de modo que el tamaño de letra y los grosores de trazo se escriben
// en las mismas unidades que el papel.

export const SVG = "http://www.w3.org/2000/svg";

// Coordenadas con dos decimales: más no se ve y el SVG sale más limpio.
export const mm = (n) => Math.round(n * 100) / 100;

export function el(doc, nombre, atributos = {}) {
  const nodo = doc.createElementNS(SVG, nombre);
  Object.entries(atributos).forEach(([k, v]) => {
    if (v !== undefined && v !== null) nodo.setAttribute(k, String(v));
  });
  return nodo;
}

export function texto(doc, x, y, contenido, clase, ancla = "middle") {
  const t = el(doc, "text", { x: mm(x), y: mm(y), "text-anchor": ancla, class: clase });
  t.textContent = String(contenido);
  return t;
}

// El lienzo: un <svg> del tamaño dado en mm, con su clase y su descripción
// para lectores de pantalla.
export function lienzo(doc, { ancho, alto, clase, descripcion }) {
  return el(doc, "svg", {
    class: `hj-figura ${clase}`,
    viewBox: `0 0 ${mm(ancho)} ${mm(alto)}`,
    width: `${mm(ancho)}mm`,
    height: `${mm(alto)}mm`,
    role: "img",
    "aria-label": descripcion,
  });
}

// El signo menos tipográfico, no el guion (ver rectaNumerica.js), y la coma
// decimal: "−3", "2,5".
export function escribeNumero(v) {
  const s = String(Math.round(v * 1000) / 1000).replace(".", ",");
  return s.startsWith("-") ? `−${s.slice(1)}` : s;
}

export const esNumero = (n) => typeof n === "number" && Number.isFinite(n);
export const esPunto = (p) => Array.isArray(p) && p.length === 2 && p.every(esNumero);
