// DIBUJAR EL CUADRANTE EN EL PDF. Solo rectángulos, rayas y texto: todo lo que
// hay que decidir está en medidasCuadrantePdf.js.
//
// UNA LÍNEA POR ALUMNO, con el curso alineado a la derecha, y los de media hora
// debajo de una raya de puntos. Jorge, 16/09/2026, viendo el primer PDF:
// *"los que ocupan solo media hora que se vean con una línea más fina o de
// puntos, tipo el horario original, y solo que aparezca nombre y curso... o
// lista con los nombres"*.
//
// EN BLANCO Y NEGRO A PROPÓSITO, como la hoja de ejercicios y por el mismo
// motivo: esto se fotocopia en el aparato del centro. La jerarquía la llevan el
// grosor del filete, el gris de la cabecera y el tono del texto, no el color.

import { lineasDeCelda } from "../../../assets/shared/js/textoDelCuadrante.js";
import {
  HUECO_CURSO_EM,
  SANGRIA_EM,
  PADDING_CELDA,
  SEPARADOR_EM,
  altoDeCabecera,
  anchoDeColumnas,
  elegirCuerpo,
  repartirEnPaginas,
} from "./medidasCuadrantePdf.js";

const NEGRO = "#000000";
// El gris de quien todavía no ha empezado. Sigue estando —la plaza está
// comprometida— pero no compite con los que vienen hoy. En una fotocopia en
// blanco y negro sigue leyéndose, que es el requisito.
const GRIS_TENUE = "#777777";
const GRIS_CURSO = "#444444";
const GRIS_CABECERA = "#EDEDED";
const GRIS_HORA = "#F7F7F7";
const FILETE = 0.6;
const FILETE_PUNTOS = 0.4;

export function crearMedidor(doc, { fuente = "Helvetica" } = {}) {
  return (texto, ancho, cuerpo) => {
    doc.font(fuente).fontSize(cuerpo);
    return doc.heightOfString(String(texto ?? ""), { width: Math.max(1, ancho) });
  };
}

export function crearMedidorDeAncho(doc, { fuente = "Helvetica" } = {}) {
  return (texto, cuerpo) => {
    doc.font(fuente).fontSize(cuerpo);
    return doc.widthOfString(String(texto ?? ""));
  };
}

export function crearAnchoHora(doc, { fuente = "Helvetica-Bold", muestra = "15:30–16:30" } = {}) {
  return (cuerpo) => {
    doc.font(fuente).fontSize(cuerpo);
    return doc.widthOfString(muestra) + PADDING_CELDA * 2;
  };
}

function marco(doc, { x, y, ancho, alto, fondo }) {
  if (fondo) doc.save().rect(x, y, ancho, alto).fill(fondo).restore();
  doc.save().lineWidth(FILETE).strokeColor(NEGRO).rect(x, y, ancho, alto).stroke().restore();
}

// La raya de puntos que abre el bloque de los de media hora. Fina y punteada
// para que se lea como "aquí empieza otra cosa" sin parecer otra casilla.
function rayaDePuntos(doc, { x, y, ancho }) {
  doc.save().lineWidth(FILETE_PUNTOS).strokeColor("#999999").dash(1.5, { space: 1.5 })
    .moveTo(x, y).lineTo(x + ancho, y).stroke().undash().restore();
}

// Las líneas de una casilla, una por alumno. El curso va a la derecha para que
// esa columna quede recta y se pueda leer en vertical, y el nombre se mide
// contra el ancho que queda para que no se monten.
function dibujarCelda(doc, { celda, x, y, ancho, alto, cuerpo, medirTexto, medirAncho }) {
  const lineas = lineasDeCelda(celda);
  if (!lineas.length) return;
  const util = ancho - PADDING_CELDA * 2;
  let cursor = y + PADDING_CELDA;

  for (const linea of lineas) {
    if (linea.separadorAntes) {
      // La raya ARRIBA del hueco y el texto DEBAJO. Dibujándola en mitad del
      // hueco caía encima del nombre (visto en el PDF de prueba: la raya
      // tachaba a Rakel y a Ixeya): pdfkit escribe el texto con su ascendente
      // por debajo de la `y` que se le da, así que el hueco real es menor que
      // el que uno calcula.
      const hueco = cuerpo * SEPARADOR_EM;
      rayaDePuntos(doc, { x: x + PADDING_CELDA, y: cursor + hueco * 0.35, ancho: util });
      cursor += hueco;
    }

    const anchoCurso = linea.derecha ? medirAncho(linea.derecha, cuerpo) + cuerpo * HUECO_CURSO_EM : 0;
    // La línea del "desde" va sangrada: así se lee como una nota del alumno de
    // arriba y no como otro alumno más.
    const sangria = linea.sangrada ? cuerpo * SANGRIA_EM : 0;
    const anchoNombre = Math.max(1, util - anchoCurso - sangria);

    doc.font("Helvetica").fontSize(cuerpo).fillColor(linea.tenue ? GRIS_TENUE : NEGRO);
    doc.text(linea.izquierda, x + PADDING_CELDA + sangria, cursor, { width: anchoNombre });

    if (linea.derecha) {
      doc.font("Helvetica").fontSize(cuerpo).fillColor(linea.tenue ? GRIS_TENUE : GRIS_CURSO);
      doc.text(linea.derecha, x + PADDING_CELDA, cursor, { width: util, align: "right" });
    }

    cursor += medirTexto(linea.izquierda, anchoNombre, cuerpo);
  }
}

function dibujarCabecera(doc, { columnas, anchos, cuerpo, x, y, alto }) {
  const titulo = (texto, cx, ancho) => {
    marco(doc, { x: cx, y, ancho, alto, fondo: GRIS_CABECERA });
    doc.font("Helvetica-Bold").fontSize(cuerpo * 1.05).fillColor(NEGRO);
    doc.text(texto, cx + PADDING_CELDA, y + PADDING_CELDA, { width: ancho - PADDING_CELDA * 2, align: "center" });
  };
  titulo("Hora", x, anchos.hora);
  let cursor = x + anchos.hora;
  for (const col of columnas) {
    titulo(col.name, cursor, anchos.dia);
    cursor += anchos.dia;
  }
}

function dibujarFila(doc, { fila, anchos, cuerpo, x, y, medirTexto, medirAncho }) {
  marco(doc, { x, y, ancho: anchos.hora, alto: fila.alto, fondo: GRIS_HORA });
  doc.font("Helvetica-Bold").fontSize(cuerpo * 0.95).fillColor(NEGRO);
  doc.text(fila.hora, x + PADDING_CELDA, y + PADDING_CELDA, {
    width: anchos.hora - PADDING_CELDA * 2, align: "center",
  });

  let cursor = x + anchos.hora;
  for (const celda of fila.celdas) {
    marco(doc, { x: cursor, y, ancho: anchos.dia, alto: fila.alto });
    dibujarCelda(doc, { celda, x: cursor, y, ancho: anchos.dia, alto: fila.alto, cuerpo, medirTexto, medirAncho });
    cursor += anchos.dia;
  }
}

// Dibuja el cuadrante entero, paginando si hiciera falta. `nuevaPagina` se
// inyecta para que quien monta el documento decida qué va en cada página (la
// cabecera de papel solo va en la primera).
//
// Devuelve el cuerpo de letra elegido: lo usan los tests y el log para poder
// afirmar en qué tamaño salió, en vez de suponerlo.
export function dibujarCuadrante(doc, { columnas = [], filas = [], x, y, ancho, alto, nuevaPagina }) {
  if (!columnas.length || !filas.length) return { cuerpo: null, paginas: 0 };

  const medirTexto = crearMedidor(doc);
  const medirAncho = crearMedidorDeAncho(doc);
  const anchoHoraPorCuerpo = crearAnchoHora(doc);

  const { cuerpo, anchos } = elegirCuerpo({
    columnas, filas, anchoTotal: ancho, anchoHoraPorCuerpo, altoDisponible: alto, medirTexto, medirAncho,
  });

  const { paginas, altoCabecera } = repartirEnPaginas({
    columnas, filas, anchos, cuerpo, altoDisponible: alto, medirTexto, medirAncho,
  });

  paginas.forEach((filasPagina, i) => {
    const arriba = i === 0 ? y : nuevaPagina();
    dibujarCabecera(doc, { columnas, anchos, cuerpo, x, y: arriba, alto: altoCabecera });
    let cursor = arriba + altoCabecera;
    for (const fila of filasPagina) {
      dibujarFila(doc, { fila, anchos, cuerpo, x, y: cursor, medirTexto, medirAncho });
      cursor += fila.alto;
    }
  });

  return { cuerpo, paginas: paginas.length };
}

export { anchoDeColumnas, altoDeCabecera };
