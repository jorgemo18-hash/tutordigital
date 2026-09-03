import { clavePrecio } from "../../../assets/shared/js/preciosPublicos.js";
import { escribirAjustado } from "./textoPdf.js";

// La tabla de precios dentro de la cuartilla. Va en dos tiempos —medir y
// dibujar— porque la cuartilla necesita saber cuánto ocupa ANTES de
// pintarla, para centrar el contenido en el papel. Si el alto solo se
// supiera al terminar de dibujar, no habría forma de colocarlo.

const GRIS_LINEA = "#BBBBBB";
const TINTA = "#111111";
const FONDO_CABECERA = "#EFEBE5";

// El ancho de cada columna. La primera (los conceptos: "2 días / semana")
// se lleva el sitio que sobra, porque las de precio solo tienen que caber
// "55 €" — al revés, el concepto se cortaría y la tabla no diría nada.
// El 0,66 no es un número redondo por casualidad: reparte de forma que la
// columna de conceptos se queda en unos 90 pt tanto con tres columnas de
// precio como con seis, en vez de encogerse según se añaden. "3 días /
// semana" cabe en 90 pt; en 60 no.
function anchosDeTabla(ancho, nColumnas) {
  if (!nColumnas) return { anchoConcepto: ancho, anchoPrecio: 0 };
  const anchoPrecio = Math.min(58, Math.max(24, (ancho * 0.66) / nColumnas));
  return { anchoConcepto: ancho - anchoPrecio * nColumnas, anchoPrecio };
}

// La tabla se encoge para caber en el hueco que tenga, hasta un mínimo
// legible. Con doce filas y doce columnas —el tope que admite el editor— no
// hay cuartilla que valga, así que a partir de ahí se corta por abajo: más
// vale una tabla completa hasta donde llega que una tabla pisando el pie de
// la hoja.
export function medirTablaPrecios(precios, { ancho, alturaDisponible }) {
  const nFilas = precios.filas.length;
  const alturaFila = Math.max(9, Math.min(20, alturaDisponible / (nFilas + 1)));
  const caben = Math.max(0, Math.floor(alturaDisponible / alturaFila) - 1);
  const visibles = precios.filas.slice(0, caben);
  return {
    ...anchosDeTabla(ancho, precios.columnas.length),
    ancho,
    alturaFila,
    fuente: Math.max(5.5, Math.min(9.5, alturaFila - 8)),
    visibles,
    // +1 por la fila de encabezados; el remate de abajo es la última raya.
    alto: (visibles.length + 1) * alturaFila,
  };
}

function centrarEnFila(y, alturaFila, fuente) {
  return y + (alturaFila - fuente) / 2;
}

function dibujarEncabezados(doc, columnas, metrica, { x, y }) {
  const { ancho, anchoConcepto, anchoPrecio, alturaFila, fuente } = metrica;
  doc.rect(x, y, ancho, alturaFila).fillColor(FONDO_CABECERA).fill();
  columnas.forEach((columna, i) => {
    escribirAjustado(doc, columna.titulo, {
      x: x + anchoConcepto + i * anchoPrecio,
      y: centrarEnFila(y, alturaFila, fuente),
      ancho: anchoPrecio - 3,
      font: "Helvetica-Bold",
      fuente,
      // Hasta 2 puntos más pequeño antes que recortar: "Bachillerato" cabe
      // en una columna estrecha si se le deja encoger, y es la palabra que
      // aparece en la mitad de las academias.
      fuenteMin: Math.max(5, fuente - 2),
      align: "center",
      color: TINTA,
    });
  });
}

function dibujarFila(doc, fila, columnas, precios, metrica, { x, y }) {
  const { anchoConcepto, anchoPrecio, alturaFila, fuente } = metrica;
  const baseline = centrarEnFila(y, alturaFila, fuente);
  escribirAjustado(doc, fila.titulo, {
    x: x + 2, y: baseline, ancho: anchoConcepto - 4, fuente, fuenteMin: Math.max(5, fuente - 2), color: TINTA,
  });
  columnas.forEach((columna, i) => {
    escribirAjustado(doc, precios[clavePrecio(fila.id, columna.id)] || "", {
      x: x + anchoConcepto + i * anchoPrecio,
      y: baseline,
      ancho: anchoPrecio - 3,
      fuente,
      fuenteMin: Math.max(5, fuente - 2),
      align: "center",
      color: TINTA,
    });
  });
}

function raya(doc, x, y, ancho) {
  doc.moveTo(x, y).lineTo(x + ancho, y).lineWidth(0.5).strokeColor(GRIS_LINEA).stroke();
}

export function dibujarTablaPrecios(doc, precios, metrica, { x, y }) {
  let cursor = y;
  dibujarEncabezados(doc, precios.columnas, metrica, { x, y: cursor });
  cursor += metrica.alturaFila;

  for (const fila of metrica.visibles) {
    raya(doc, x, cursor, metrica.ancho);
    dibujarFila(doc, fila, precios.columnas, precios.precios, metrica, { x, y: cursor });
    cursor += metrica.alturaFila;
  }
  raya(doc, x, cursor, metrica.ancho);
  return cursor;
}
