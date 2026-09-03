// Escribir un texto que TIENE que caber en un ancho dado.
//
// La opción `ellipsis` de pdfkit no basta para una tabla: con
// `lineBreak: false` deja el texto cortado y suelta el punto suspensivo en
// la línea de abajo, y "Bachillerato" en una columna estrecha sale como
// "Bachillerat" con una mancha debajo (visto en la primera prueba de la
// hoja). Aquí se hace en dos pasos: primero se encoge la letra hasta el
// mínimo legible, y solo si aun así no cabe se recorta con "…".
//
// Encoger antes que recortar es a propósito: en un papel que se entrega a
// una familia, "Bachillerato" un punto más pequeño se lee igual, y
// "Bachiller…" es un fallo que se ve desde el otro lado de la mesa.

function anchoDe(doc, texto, fuente) {
  doc.fontSize(fuente);
  return doc.widthOfString(texto);
}

// El texto más largo que cabe, con "…" al final. Se quita carácter a
// carácter porque las cadenas son cortas (títulos de columna, conceptos) y
// una búsqueda binaria aquí solo añadiría sitios donde equivocarse.
function recortar(doc, texto, ancho, fuente) {
  let corto = texto;
  while (corto.length > 1 && anchoDe(doc, `${corto}…`, fuente) > ancho) {
    corto = corto.slice(0, -1);
  }
  return `${corto}…`;
}

export function escribirAjustado(doc, texto, {
  x, y, ancho, fuente, fuenteMin = fuente, font = "Helvetica", align = "left", color = "#111111",
} = {}) {
  const contenido = String(texto ?? "");
  doc.font(font).fillColor(color);

  let tamano = fuente;
  while (tamano > fuenteMin && anchoDe(doc, contenido, tamano) > ancho) tamano -= 0.25;

  const final = anchoDe(doc, contenido, tamano) > ancho ? recortar(doc, contenido, ancho, tamano) : contenido;
  doc.fontSize(tamano).text(final, x, y, { width: ancho, align, lineBreak: false });
  return tamano;
}
