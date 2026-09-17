import PDFDocument from "pdfkit";
import { dibujarCuartilla } from "./dibujarCuartilla.js";

// La hoja de información para familias: horario y precios del centro en un
// cuarto de folio, cuatro veces en el mismo A4.
//
// POR QUÉ CUATRO Y NO UNA. Este papel se reparte de diez en diez a los
// padres que preguntan. Con una por folio se gastan cuatro veces más folios
// y hay que recortar igual; con cuatro, un folio salen cuatro hojas y solo
// hay que dar dos tijeretazos. Es lo que pidió Jorge, y es lo que hace todo
// el mundo en una academia.
//
// POR QUÉ UN PDF DE VERDAD Y NO IMPRIMIR LA PANTALLA. Con Cmd+P el
// resultado depende de los márgenes del navegador, de si Safari mete su
// cabecera con la fecha y de la escala que elija cada uno: las cuatro
// cuartillas dejan de caer donde deben. Aquí el reparto del folio está
// escrito en puntos y sale igual en cualquier impresora. Y de propina, un
// PDF se le puede mandar por WhatsApp a la madre que pregunta sin que venga
// a por el papel.
//
// Se genera en el propio backend con pdfkit —igual que el listado de
// fichajes— y NO en el microservicio de PDF de Render: ese está en el plan
// gratuito y un arranque en frío tarda hasta tres minutos y medio
// (verificado en producción). Aquí no hay nada que renderizar con
// LibreOffice, así que no compensa esperar eso para dibujar cuatro
// rectángulos.

// POR QUÉ TAMBIÉN HAY UNA VERSIÓN DE UNA SOLA CUARTILLA (17/09/2026, Jorge:
// *"cuando le das a descargar, en vez de descargarse los cuatro, solo
// estuviera uno, en plan por si alguien me pregunta por WhatsApp"*).
//
// Las cuatro son para el folio y las tijeras. Para mandárselo a una madre
// por WhatsApp son un estorbo: se ve el mismo papel repetido cuatro veces
// con dos rayas de corte por encima, y en la pantalla de un móvil hay que
// hacer zoom para leer un cuarto de la imagen. Es exactamente el problema
// que tiene mandar una foto del papel.
//
// EL FOLIO DE LA VERSIÓN DE UNA ES A6, no A4 con una cuartilla arriba y el
// resto en blanco, y no A5 tampoco. A6 son las medidas EXACTAS de un cuarto
// de A4, así que es literalmente el mismo papel que sale de las tijeras: el
// dibujo no se toca, los cuerpos de letra no se toca, y en el móvil se abre
// llenando la pantalla. En A5 el mismo texto de 6,8 pt quedaría diminuto en
// medio de un palmo de blanco, porque `dibujarCuartilla` escala el
// rectángulo pero no las fuentes.
const A4 = [595.28, 841.89];
const A6 = [A4[0] / 2, A4[1] / 2];
const CUATRO_ESQUINAS = [
  [0, 0], [0.5, 0], [0, 0.5], [0.5, 0.5],
];

// Las guías de corte: dos rayas de puntos por la mitad del folio. Sin ellas
// hay que adivinar dónde cortar y las cuatro cuartillas salen desiguales.
// En gris claro y punteadas para que se vean al cortar y no canten en el
// papel ya recortado.
function dibujarGuiasDeCorte(doc, [ancho, alto]) {
  doc.save().lineWidth(0.4).strokeColor("#CCCCCC").dash(3, { space: 3 });
  doc.moveTo(ancho / 2, 0).lineTo(ancho / 2, alto).stroke();
  doc.moveTo(0, alto / 2).lineTo(ancho, alto / 2).stroke();
  doc.undash().restore();
}

// `datos` viene de construirPayloadHojaFamilias(). Devuelve un Buffer, no
// escribe a disco: la ruta lo manda tal cual en la respuesta.
//
// `copias`: 4 (A4 con las cuatro cuartillas y sus guías, para imprimir y
// cortar) o 1 (una sola cuartilla en A6, para mandar por WhatsApp). Cualquier
// otro valor se trata como 4: el comportamiento por defecto es el de
// imprimir, que es para lo que existe este documento.
export function buildHojaFamiliasPdfBuffer(datos, { copias = 4 } = {}) {
  const una = Number(copias) === 1;
  return new Promise((resolve, reject) => {
    // Sin comprimir: la hoja son cuatro rectángulos y unas líneas de texto,
    // así que el archivo pasa de 3 KB a 8 KB —da igual para lo que es— y a
    // cambio el contenido queda legible dentro del PDF. Eso permite que el
    // test compruebe de verdad que el nombre del centro sale CUATRO veces,
    // que es justo lo que hace que este documento sirva para algo.
    const folio = una ? A6 : A4;
    const doc = new PDFDocument({ size: folio, margin: 0, compress: false });
    const trozos = [];
    doc.on("data", (trozo) => trozos.push(trozo));
    doc.on("end", () => resolve(Buffer.concat(trozos)));
    doc.on("error", reject);

    const [ancho, alto] = folio;
    if (una) {
      // Sin guías de corte: no hay nada que cortar, y dos rayas punteadas en
      // un papel que se manda por el móvil solo dicen "esto está a medias".
      dibujarCuartilla(doc, datos, { x: 0, y: 0, ancho, alto });
    } else {
      dibujarGuiasDeCorte(doc, folio);
      for (const [fx, fy] of CUATRO_ESQUINAS) {
        dibujarCuartilla(doc, datos, { x: ancho * fx, y: alto * fy, ancho: ancho / 2, alto: alto / 2 });
      }
    }

    doc.end();
  });
}
