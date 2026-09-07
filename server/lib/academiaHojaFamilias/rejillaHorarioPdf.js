import { escribirAjustado } from "./textoPdf.js";

// El horario como REJILLA de días × horas: el curso de cada casilla, y las
// horas completas sombreadas.
//
// Es la forma en la que Jorge lo llevaba a mano en papel, y para lo que lo
// usa delante de una familia: ve de un vistazo dónde queda sitio y rodea a
// bolígrafo las horas que eligen. Una lista de horas no se puede rodear ni
// dice dónde hay hueco.
//
// El sombreado dice "completa", no cuántas plazas quedan: un "4/6" impreso
// caduca esa misma tarde, mientras que una hora llena sigue llena semanas.

const GRIS = "#666666";
const GRIS_LINEA = "#DDDDDD";
const TINTA = "#111111";
// Un gris de trama, no un color: la hoja se imprime en blanco y negro y una
// casilla en rojo saldría del mismo gris que una en azul.
const FONDO_COMPLETA = "#DDD8D0";
const TINTA_COMPLETA = "#5C554C";

const ALTO_FILA = 12;
const ANCHO_HORA = 74;
const FUENTE = 6.8;

const ALTO_LEYENDA = 12;

export function altoRejillaHorario(rejilla) {
  return (rejilla.filas.length + 1) * ALTO_FILA + (rejilla.hayCompletas ? ALTO_LEYENDA : 0);
}

function anchoDeDia(ancho, nDias) {
  return nDias ? (ancho - ANCHO_HORA) / nDias : 0;
}

function dibujarCabecera(doc, dias, { x, y, ancho }) {
  const anchoDia = anchoDeDia(ancho, dias.length);
  dias.forEach((dia, i) => {
    escribirAjustado(doc, dia, {
      x: x + ANCHO_HORA + i * anchoDia,
      y,
      ancho: anchoDia - 2,
      font: "Helvetica-Bold",
      fuente: FUENTE,
      fuenteMin: 5,
      align: "center",
      color: GRIS,
    });
  });
}

// Una casilla con curso reservado va en negro y en negrita; "Todos" en gris
// y normal. Es lo que permite encontrar de un vistazo las horas de Primaria
// sin tener que leer las veinticinco casillas — sin gastar un solo color de
// tinta más, que este papel se imprime en blanco y negro.
//
// Una casilla COMPLETA se sombrea entera. El sombreado se pinta antes que el
// texto, si no lo taparía.
function dibujarFila(doc, fila, { x, y, ancho, nDias }) {
  const anchoDia = anchoDeDia(ancho, nDias);
  escribirAjustado(doc, fila.hora, {
    x, y, ancho: ANCHO_HORA - 4, fuente: FUENTE, fuenteMin: 5, color: TINTA,
  });

  fila.celdas.forEach((celda, i) => {
    if (!celda.completo) return;
    doc.rect(x + ANCHO_HORA + i * anchoDia - 1, y - 3, anchoDia - 1, ALTO_FILA - 1)
      .fillColor(FONDO_COMPLETA).fill();
  });

  fila.celdas.forEach((celda, i) => {
    const reservada = Boolean(celda.texto) && celda.texto !== "Todos";
    escribirAjustado(doc, celda.texto, {
      x: x + ANCHO_HORA + i * anchoDia,
      y,
      ancho: anchoDia - 2,
      font: reservada ? "Helvetica-Bold" : "Helvetica",
      fuente: FUENTE,
      fuenteMin: 5,
      align: "center",
      color: celda.completo ? TINTA_COMPLETA : (reservada ? TINTA : GRIS),
    });
  });
}

export function dibujarRejillaHorario(doc, rejilla, { x, y, ancho }) {
  dibujarCabecera(doc, rejilla.dias, { x, y, ancho });
  let cursor = y + ALTO_FILA;

  for (const fila of rejilla.filas) {
    doc.moveTo(x, cursor - 2).lineTo(x + ancho, cursor - 2).lineWidth(0.4).strokeColor(GRIS_LINEA).stroke();
    dibujarFila(doc, fila, { x, y: cursor, ancho, nDias: rejilla.dias.length });
    cursor += ALTO_FILA;
  }

  if (rejilla.hayCompletas) {
    doc.font("Helvetica-Oblique").fontSize(6).fillColor(GRIS)
      .text("Las horas sombreadas están completas.", x, cursor, { width: ancho, lineBreak: false });
    cursor += ALTO_LEYENDA;
  }
  return cursor;
}
