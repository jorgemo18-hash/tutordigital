import { escribirAjustado } from "./textoPdf.js";
import { medirTablaPrecios, dibujarTablaPrecios } from "./tablaPreciosPdf.js";

// Dibuja UNA cuartilla (un cuarto de folio) dentro del rectángulo que se le
// pase. No sabe nada de páginas ni de cuántas copias hay: eso lo decide
// generarHojaFamilias.js, que la llama cuatro veces con cuatro esquinas
// distintas. Separarlo es lo que permite cambiar el reparto del folio sin
// tocar el diseño, y al revés.
//
// Todo va en puntos PostScript (1 mm = 2.83 pt) y en las fuentes de serie
// del PDF (Helvetica): sin fuentes incrustadas el archivo pesa 4 KB y se
// abre igual en cualquier sitio, incluido el móvil de una madre a la que se
// le manda por WhatsApp.
//
// EL REPARTO VERTICAL. Nombre del centro arriba y contacto abajo, anclados;
// en medio, horario y precios como un solo bloque CENTRADO. Una academia
// con cinco horas y cuatro tarifas no llena una cuartilla ni de lejos, y
// dejando el contenido pegado arriba queda un palmo en blanco justo encima
// del teléfono — que es lo que hace que un papel parezca mal hecho aunque
// la información esté toda.

const GRIS = "#666666";
const GRIS_LINEA = "#BBBBBB";
const TINTA = "#111111";

const MARGEN = 18;
const ALTO_ROTULO = 13;
const ALTO_DIAS = 17;
const ALTO_HORA = 14;
const ALTO_NOTA = 14;
const SEPARACION = 18;
const ALTO_LINEA_PIE = 9;

function linea(doc, x, y, ancho, color = GRIS_LINEA) {
  doc.moveTo(x, y).lineTo(x + ancho, y).lineWidth(0.5).strokeColor(color).stroke();
}

// Un rótulo de sección: "HORARIO", "PRECIOS". Mayúsculas pequeñas y
// espaciadas, que es lo que separa dos bloques sin gastar una línea entera
// en un título grande — en una cuartilla no sobra ni un renglón.
function rotulo(doc, texto, x, y, ancho) {
  doc.font("Helvetica-Bold").fontSize(7).fillColor(GRIS)
    .text(texto.toUpperCase(), x, y, { width: ancho, characterSpacing: 1.1 });
  return y + ALTO_ROTULO;
}

// El nombre del centro y la raya de debajo. Devuelve dónde empieza el hueco
// del contenido.
function dibujarCabecera(doc, { academia }, { x, y, ancho }) {
  escribirAjustado(doc, academia, {
    x, y, ancho, font: "Helvetica-Bold", fuente: 15, fuenteMin: 10, align: "center", color: TINTA,
  });
  const abajo = y + 22;
  linea(doc, x, abajo, ancho, GRIS);
  return abajo + 12;
}

// Las horas van en dos columnas cuando son más de tres: en vertical, seis
// horas se comen la mitad de la cuartilla, que es el sitio que necesita la
// tabla de precios.
function filasDeHorario(bloques) {
  const columnas = bloques.length > 3 ? 2 : 1;
  return { columnas, filas: Math.ceil(bloques.length / columnas) };
}

function altoHorario({ dias, bloques }) {
  return ALTO_ROTULO + (dias ? ALTO_DIAS : 0) + filasDeHorario(bloques).filas * ALTO_HORA;
}

function dibujarHorario(doc, { dias, bloques }, { x, y, ancho }) {
  let cursor = rotulo(doc, "Horario", x, y, ancho);

  if (dias) {
    escribirAjustado(doc, dias, { x, y: cursor, ancho, font: "Helvetica-Bold", fuente: 10.5, fuenteMin: 8, color: TINTA });
    cursor += ALTO_DIAS;
  }

  const { columnas, filas } = filasDeHorario(bloques);
  const anchoCol = ancho / columnas;
  bloques.forEach((bloque, i) => {
    // Se rellena por columnas (las tres primeras horas a la izquierda, el
    // resto a la derecha): así se lee de arriba abajo en orden, que es como
    // se busca una hora.
    escribirAjustado(doc, bloque, {
      x: x + Math.floor(i / filas) * anchoCol,
      y: cursor + (i % filas) * ALTO_HORA,
      ancho: anchoCol - 6,
      fuente: 10,
      fuenteMin: 8,
      color: TINTA,
    });
  });

  return cursor + filas * ALTO_HORA;
}

function dibujarPrecios(doc, precios, metrica, { x, y, ancho }) {
  let cursor = rotulo(doc, "Precios", x, y, ancho);
  cursor = dibujarTablaPrecios(doc, precios, metrica, { x, y: cursor }) + 4;

  if (precios.nota) {
    doc.font("Helvetica-Oblique").fontSize(6.5).fillColor(GRIS)
      .text(precios.nota, x, cursor, { width: ancho, ellipsis: true });
  }
}

// El contacto va anclado ABAJO, no detrás de lo anterior: así las cuatro
// cuartillas del folio tienen el pie a la misma altura aunque una academia
// tenga cinco horas y otra ocho.
function altoPie(contacto) {
  return contacto.length ? contacto.length * ALTO_LINEA_PIE + 10 : 0;
}

function dibujarPie(doc, contacto, { x, ancho, abajo }) {
  if (!contacto.length) return;
  let cursor = abajo - contacto.length * ALTO_LINEA_PIE;
  linea(doc, x, cursor - 5, ancho);
  doc.font("Helvetica").fontSize(7.5).fillColor(GRIS);
  for (const texto of contacto) {
    doc.text(texto, x, cursor, { width: ancho, align: "center", ellipsis: true, lineBreak: false });
    cursor += ALTO_LINEA_PIE;
  }
}

export function dibujarCuartilla(doc, datos, { x, y, ancho, alto }) {
  const izquierda = x + MARGEN;
  const anchoUtil = ancho - MARGEN * 2;
  const abajo = y + alto - MARGEN;

  const arriba = dibujarCabecera(doc, datos, { x: izquierda, y: y + MARGEN, ancho: anchoUtil });
  const banda = abajo - altoPie(datos.contacto) - arriba;

  const altoDelHorario = altoHorario(datos);
  const metrica = datos.precios
    ? medirTablaPrecios(datos.precios, {
      ancho: anchoUtil,
      alturaDisponible: banda - altoDelHorario - SEPARACION - ALTO_ROTULO - (datos.precios.nota ? ALTO_NOTA : 0),
    })
    : null;

  const altoDeLosPrecios = metrica
    ? ALTO_ROTULO + metrica.alto + 4 + (datos.precios.nota ? ALTO_NOTA : 0)
    : 0;
  const contenido = altoDelHorario + (metrica ? SEPARACION + altoDeLosPrecios : 0);

  let cursor = arriba + Math.max(0, (banda - contenido) / 2);
  cursor = dibujarHorario(doc, datos, { x: izquierda, y: cursor, ancho: anchoUtil });
  if (metrica) {
    dibujarPrecios(doc, datos.precios, metrica, { x: izquierda, y: cursor + SEPARACION, ancho: anchoUtil });
  }

  dibujarPie(doc, datos.contacto, { x: izquierda, ancho: anchoUtil, abajo });
}
