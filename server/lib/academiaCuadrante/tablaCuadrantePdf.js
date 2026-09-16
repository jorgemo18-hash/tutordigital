// DIBUJAR EL CUADRANTE EN EL PDF. Solo rectángulos y texto: todo lo que hay
// que decidir está en medidasCuadrantePdf.js.
//
// EN BLANCO Y NEGRO A PROPÓSITO, como la hoja de ejercicios y por el mismo
// motivo: esto se fotocopia en el aparato del centro. La jerarquía la llevan
// el grosor del filete, el gris de la cabecera y la tipografía, no el color.

import {
  PADDING_CELDA,
  altoDeCabecera,
  anchoDeColumnas,
  elegirCuerpo,
  repartirEnPaginas,
} from "./medidasCuadrantePdf.js";

const NEGRO = "#000000";
const GRIS_CABECERA = "#EDEDED";
const GRIS_HORA = "#F7F7F7";
const FILETE = 0.6;

// El alto que pdfkit dará a un texto dentro de un ancho. Es la medida REAL de
// la tipografía que se va a imprimir, no una estimación: es toda la diferencia
// con intentar adivinarlo desde el navegador.
export function crearMedidor(doc, { fuente = "Helvetica" } = {}) {
  return (texto, ancho, cuerpo) => {
    doc.font(fuente).fontSize(cuerpo);
    return doc.heightOfString(String(texto ?? ""), { width: Math.max(1, ancho) });
  };
}

// Lo que mide "15:30–16:30" con un cuerpo dado, más su aire. La columna de la
// hora no se reparte el ancho con las demás: se queda con lo justo.
export function crearAnchoHora(doc, { fuente = "Helvetica-Bold", muestra = "15:30–16:30" } = {}) {
  return (cuerpo) => {
    doc.font(fuente).fontSize(cuerpo);
    return doc.widthOfString(muestra) + PADDING_CELDA * 2;
  };
}

function celda(doc, { x, y, ancho, alto, texto, cuerpo, fuente, fondo, centrado = false }) {
  if (fondo) doc.save().rect(x, y, ancho, alto).fill(fondo).restore();
  doc.save().lineWidth(FILETE).strokeColor(NEGRO).rect(x, y, ancho, alto).stroke().restore();
  if (!texto) return;
  doc.font(fuente).fontSize(cuerpo).fillColor(NEGRO);
  doc.text(String(texto), x + PADDING_CELDA, y + PADDING_CELDA, {
    width: ancho - PADDING_CELDA * 2,
    align: centrado ? "center" : "left",
  });
}

function dibujarCabecera(doc, { columnas, anchos, cuerpo, x, y, alto }) {
  celda(doc, { x, y, ancho: anchos.hora, alto, texto: "Hora", cuerpo, fuente: "Helvetica-Bold", fondo: GRIS_CABECERA, centrado: true });
  let cursor = x + anchos.hora;
  for (const col of columnas) {
    celda(doc, { x: cursor, y, ancho: anchos.dia, alto, texto: col.name, cuerpo, fuente: "Helvetica-Bold", fondo: GRIS_CABECERA, centrado: true });
    cursor += anchos.dia;
  }
}

function dibujarFila(doc, { fila, anchos, cuerpo, x, y }) {
  celda(doc, { x, y, ancho: anchos.hora, alto: fila.alto, texto: fila.hora, cuerpo, fuente: "Helvetica-Bold", fondo: GRIS_HORA, centrado: true });
  let cursor = x + anchos.hora;
  for (const texto of fila.celdas) {
    celda(doc, { x: cursor, y, ancho: anchos.dia, alto: fila.alto, texto, cuerpo, fuente: "Helvetica" });
    cursor += anchos.dia;
  }
}

// Dibuja el cuadrante entero, paginando si hiciera falta. `nuevaPagina` se
// inyecta para que quien monta el documento decida qué va en cada página
// (la cabecera de papel solo va en la primera).
//
// Devuelve el cuerpo de letra elegido: lo usan los tests y el log para poder
// afirmar en qué tamaño salió, en vez de suponerlo.
export function dibujarCuadrante(doc, {
  columnas = [],
  filas = [],
  x,
  y,
  ancho,
  alto,
  nuevaPagina,
}) {
  if (!columnas.length || !filas.length) return { cuerpo: null, paginas: 0 };

  const medirTexto = crearMedidor(doc);
  const anchoHoraPorCuerpo = crearAnchoHora(doc);

  const { cuerpo, anchos } = elegirCuerpo({
    columnas, filas, anchoTotal: ancho, anchoHoraPorCuerpo, altoDisponible: alto, medirTexto,
  });

  const { paginas, altoCabecera } = repartirEnPaginas({
    columnas, filas, anchos, cuerpo, altoDisponible: alto, medirTexto,
  });

  paginas.forEach((filasPagina, i) => {
    const arriba = i === 0 ? y : nuevaPagina();
    dibujarCabecera(doc, { columnas, anchos, cuerpo, x, y: arriba, alto: altoCabecera });
    let cursor = arriba + altoCabecera;
    for (const fila of filasPagina) {
      dibujarFila(doc, { fila, anchos, cuerpo, x, y: cursor });
      cursor += fila.alto;
    }
  });

  return { cuerpo, paginas: paginas.length };
}

export { anchoDeColumnas, altoDeCabecera };
