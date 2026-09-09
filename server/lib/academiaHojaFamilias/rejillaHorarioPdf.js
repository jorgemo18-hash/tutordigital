import { escribirAjustado } from "./textoPdf.js";

// El horario como CUADRÍCULA de días × horas: una casilla por hueco, con
// borde, y las horas completas en rojo.
//
// Es la forma en la que Jorge lo llevaba a mano en papel, y para lo que lo
// usa delante de una familia: ve de un vistazo dónde queda sitio y rodea a
// bolígrafo las horas que eligen. Una lista de horas no se puede rodear ni
// dice dónde hay hueco.
//
// POR QUÉ CASILLAS DE VERDAD Y NO RAYAS. La primera versión dibujaba solo
// una línea fina entre filas y sombreaba en gris las horas llenas: sobre el
// papel no se leía como una tabla, y el gris de la casilla completa se
// confundía con el fondo. Con borde en las cuatro esquinas la rejilla se
// rodea a bolígrafo sin salirse, y en rojo la hora llena se ve desde el otro
// lado de la mesa.
//
// EL ROJO Y LA IMPRESORA EN BLANCO Y NEGRO. En una impresora de tinta negra
// el relleno rojo sale como un gris claro, así que la casilla llena SIGUE
// distinguiéndose: se pinta el relleno, el borde más oscuro y el texto en el
// mismo tono, tres señales en vez de una. Y por si el papel se fotocopia mal
// hasta perderlo todo, debajo va la leyenda escrita.
//
// EL "4/6" DE CADA CASILLA (decidido por Jorge el 09/09/2026). Antes solo
// se marcaba lo lleno, con el argumento de que un número impreso caduca esa
// misma tarde mientras que una hora llena sigue llena semanas. El argumento
// sigue siendo cierto y por eso el rojo se queda: es la señal que aguanta.
// Pero la casilla estaba vacía y el hueco era suyo, así que el número entra
// con dos condiciones que salen de los propios contras:
//
//   - CON DENOMINADOR, "4/6" y nunca "4". Lo señaló Jorge: un número solo no
//     dice si son cuatro dentro o cuatro libres, y quien lo lea al revés se
//     planta un martes creyendo que tiene sitio.
//   - NO SE IMPRIME EL CERO. En el horario real de Lyceo hay cinco casillas
//     a cero, y las cinco son la fila de 19:30–20:30 entera. Esa fila está
//     ahí para decir hasta qué hora abre el centro, no para anunciar que no
//     viene nadie: cinco "0/6" seguidos en un papel que se lleva la familia
//     dicen lo segundo. Sin tope configurado tampoco se imprime — no hay
//     denominador y el número volvería a ser ambiguo.

const GRIS = "#666666";
const TINTA = "#111111";
const BORDE = "#AAAAAA";
const CABECERA_FONDO = "#F2F2F2";

const ROJO = "#B3261E";
const ROJO_FONDO = "#F6D9D6";
const ROJO_BORDE = "#C86B62";

const ALTO_FILA = 13;
const ANCHO_HORA = 66;
const FUENTE = 6.8;
const FUENTE_MIN = 5;
// Cuánto baja el texto dentro de su casilla para quedar centrado: pdfkit
// coloca el ALTO de la línea en la `y` que se le da, no su centro.
const SANGRIA_TEXTO = 3;
const SANGRIA_HORA = 3;

const ALTO_LEYENDA = 12;

// El "4/6" va más pequeño que el rótulo del curso a propósito: es un dato de
// apoyo, no lo que se lee primero. 5,2 pt sigue siendo legible impreso (la
// nota del pie va a 6).
const FUENTE_OCUPACION = 5.2;
const ANCHO_OCUPACION = 14;
// Baja un pelo más que el rótulo para que las dos cosas queden alineadas por
// la base pese a tener cuerpos distintos.
const SANGRIA_OCUPACION = 4;

export function altoRejillaHorario(rejilla) {
  return (rejilla.filas.length + 1) * ALTO_FILA + (rejilla.hayCompletas ? ALTO_LEYENDA : 0);
}

// Dónde cae cada casilla. Se calcula una vez y se le pasa a cada paso del
// dibujo, en vez de repetir la misma cuenta en cuatro sitios: el fallo
// clásico de estas tablas es que el relleno y el borde se dibujen con
// márgenes distintos y quede un pelo blanco entre ambos.
function geometria(rejilla, { x, y, ancho }) {
  const nDias = rejilla.dias.length || 1;
  const anchoDia = (ancho - ANCHO_HORA) / nDias;
  return {
    anchoDia,
    alto: (rejilla.filas.length + 1) * ALTO_FILA,
    xDia: (i) => x + ANCHO_HORA + i * anchoDia,
    yFila: (i) => y + (i + 1) * ALTO_FILA,
  };
}

// El relleno va PRIMERO, antes que las líneas y el texto: pintado después
// los taparía.
function pintarCompletas(doc, rejilla, geo) {
  rejilla.filas.forEach((fila, f) => {
    fila.celdas.forEach((celda, d) => {
      if (!celda.completo) return;
      doc.rect(geo.xDia(d), geo.yFila(f), geo.anchoDia, ALTO_FILA).fillColor(ROJO_FONDO).fill();
    });
  });
}

function pintarCabecera(doc, geo, { x, y, ancho }) {
  doc.rect(x + ANCHO_HORA, y, ancho - ANCHO_HORA, ALTO_FILA).fillColor(CABECERA_FONDO).fill();
}

// La cuadrícula entera de un tirón. La columna de las horas no se encierra
// en cajas —no es una casilla que se pueda elegir, es la etiqueta de la
// fila—, así que las verticales empiezan en la primera columna de día.
function dibujarLineas(doc, rejilla, geo, { x, y, ancho }) {
  doc.lineWidth(0.4).strokeColor(BORDE);
  for (let f = 0; f <= rejilla.filas.length + 1; f += 1) {
    const yLinea = y + f * ALTO_FILA;
    const desde = f === 0 ? x + ANCHO_HORA : x;
    doc.moveTo(desde, yLinea).lineTo(x + ancho, yLinea).stroke();
  }
  for (let d = 0; d <= rejilla.dias.length; d += 1) {
    doc.moveTo(geo.xDia(d), y).lineTo(geo.xDia(d), y + geo.alto).stroke();
  }
}

// El borde propio de las casillas llenas, repasado ENCIMA de la cuadrícula
// gris y un poco más grueso. Sin esto el rojo del relleno queda encerrado en
// un marco gris y pierde la mitad de la fuerza.
function repasarCompletas(doc, rejilla, geo) {
  doc.lineWidth(0.7).strokeColor(ROJO_BORDE);
  rejilla.filas.forEach((fila, f) => {
    fila.celdas.forEach((celda, d) => {
      if (!celda.completo) return;
      doc.rect(geo.xDia(d), geo.yFila(f), geo.anchoDia, ALTO_FILA).stroke();
    });
  });
}

function escribirCabecera(doc, rejilla, geo, { y }) {
  rejilla.dias.forEach((dia, d) => {
    escribirAjustado(doc, dia, {
      x: geo.xDia(d) + 1,
      y: y + SANGRIA_TEXTO,
      ancho: geo.anchoDia - 2,
      font: "Helvetica-Bold",
      fuente: FUENTE,
      fuenteMin: FUENTE_MIN,
      align: "center",
      color: GRIS,
    });
  });
}

// Una casilla con curso reservado va en negrita; "Todos" en gris y normal.
// Es lo que permite encontrar de un vistazo las horas de Primaria sin leer
// las veinticinco casillas. Si está completa manda el rojo por encima de
// todo lo demás.
function colorDeCelda(celda, reservada) {
  if (celda.completo) return ROJO;
  return reservada ? TINTA : GRIS;
}

// "4/6", o cadena vacía si no hay que imprimirlo. Ver la cabecera: sin tope
// no hay denominador, y el cero no se anuncia.
export function textoOcupacion(celda, max) {
  const ocupada = Number(celda?.ocupacion || 0);
  const tope = Number(max) || 0;
  if (tope <= 0 || ocupada <= 0) return "";
  return `${ocupada}/${tope}`;
}

// El número comparte casilla con el rótulo del curso ("Primaria", "Todos"),
// que va centrado. Cuando hay rótulo el número se va a la derecha y el
// rótulo se centra en lo que queda; cuando la casilla no tiene rótulo —el
// caso de Lyceo, que no usa cursos por hora— el número es el único
// contenido y va centrado, que es donde el ojo lo busca.
function escribirOcupacion(doc, celda, { xCelda, y, ancho, max, hayRotulo }) {
  const texto = textoOcupacion(celda, max);
  if (!texto) return 0;
  const anchoNum = ANCHO_OCUPACION;
  escribirAjustado(doc, texto, {
    x: hayRotulo ? xCelda + ancho - anchoNum - 1 : xCelda + 1,
    y: y + SANGRIA_OCUPACION,
    ancho: hayRotulo ? anchoNum : ancho - 2,
    fuente: FUENTE_OCUPACION,
    fuenteMin: FUENTE_OCUPACION,
    align: hayRotulo ? "right" : "center",
    color: celda.completo ? ROJO : GRIS,
  });
  return anchoNum;
}

function escribirCeldas(doc, rejilla, geo, { x }) {
  rejilla.filas.forEach((fila, f) => {
    const y = geo.yFila(f);
    escribirAjustado(doc, fila.hora, {
      x: x + SANGRIA_HORA,
      y: y + SANGRIA_TEXTO,
      ancho: ANCHO_HORA - SANGRIA_HORA - 4,
      fuente: FUENTE,
      fuenteMin: FUENTE_MIN,
      color: TINTA,
    });

    fila.celdas.forEach((celda, d) => {
      const reservada = Boolean(celda.texto) && celda.texto !== "Todos";
      const hayRotulo = Boolean(celda.texto);
      const ocupado = escribirOcupacion(doc, celda, {
        xCelda: geo.xDia(d), y, ancho: geo.anchoDia, max: rejilla.max, hayRotulo,
      });
      if (!hayRotulo) return;
      // El rótulo se centra en lo que deja el número, no en la casilla
      // entera: centrado a pelo se le montaría encima en las casillas
      // estrechas de un centro con seis días.
      escribirAjustado(doc, celda.texto, {
        x: geo.xDia(d) + 1,
        y: y + SANGRIA_TEXTO,
        ancho: geo.anchoDia - 2 - ocupado,
        font: reservada || celda.completo ? "Helvetica-Bold" : "Helvetica",
        fuente: FUENTE,
        fuenteMin: FUENTE_MIN,
        align: "center",
        color: colorDeCelda(celda, reservada),
      });
    });
  });
}

export function dibujarRejillaHorario(doc, rejilla, { x, y, ancho }) {
  const geo = geometria(rejilla, { x, y, ancho });

  pintarCabecera(doc, geo, { x, y, ancho });
  pintarCompletas(doc, rejilla, geo);
  dibujarLineas(doc, rejilla, geo, { x, y, ancho });
  repasarCompletas(doc, rejilla, geo);
  escribirCabecera(doc, rejilla, geo, { y });
  escribirCeldas(doc, rejilla, geo, { x });

  let cursor = y + geo.alto;
  if (rejilla.hayCompletas) {
    doc.font("Helvetica-Oblique").fontSize(6).fillColor(ROJO)
      .text("Las horas en rojo están completas.", x, cursor + 3, { width: ancho, lineBreak: false });
    cursor += ALTO_LEYENDA;
  }
  return cursor;
}
