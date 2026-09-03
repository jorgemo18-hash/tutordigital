import { escribirAjustado } from "./textoPdf.js";

// El horario como REJILLA de días × horas, con el curso de cada casilla.
//
// Solo se usa cuando el centro reserva alguna hora para un curso ("los
// lunes a las 17:30 solo viene Primaria"). Si no reserva ninguna, la hoja
// imprime la lista de horas de siempre: veinticinco casillas diciendo
// "Todos" gastarían media cuartilla para no decir nada. Quién decide es
// payloadHojaFamilias.js, que devuelve `rejilla` o null.

const GRIS = "#666666";
const GRIS_LINEA = "#DDDDDD";
const TINTA = "#111111";

const ALTO_FILA = 12;
const ANCHO_HORA = 74;
const FUENTE = 6.8;

export function altoRejillaHorario(rejilla) {
  return (rejilla.filas.length + 1) * ALTO_FILA;
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
function dibujarFila(doc, fila, { x, y, ancho, nDias }) {
  const anchoDia = anchoDeDia(ancho, nDias);
  escribirAjustado(doc, fila.hora, {
    x, y, ancho: ANCHO_HORA - 4, fuente: FUENTE, fuenteMin: 5, color: TINTA,
  });
  fila.celdas.forEach((celda, i) => {
    const reservada = celda !== "Todos";
    escribirAjustado(doc, celda, {
      x: x + ANCHO_HORA + i * anchoDia,
      y,
      ancho: anchoDia - 2,
      font: reservada ? "Helvetica-Bold" : "Helvetica",
      fuente: FUENTE,
      fuenteMin: 5,
      align: "center",
      color: reservada ? TINTA : GRIS,
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
  return cursor;
}
