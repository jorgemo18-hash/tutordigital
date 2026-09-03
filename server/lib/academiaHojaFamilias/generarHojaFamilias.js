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

const A4 = [595.28, 841.89];
const COPIAS = [
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
export function buildHojaFamiliasPdfBuffer(datos) {
  return new Promise((resolve, reject) => {
    // Sin comprimir: la hoja son cuatro rectángulos y unas líneas de texto,
    // así que el archivo pasa de 3 KB a 8 KB —da igual para lo que es— y a
    // cambio el contenido queda legible dentro del PDF. Eso permite que el
    // test compruebe de verdad que el nombre del centro sale CUATRO veces,
    // que es justo lo que hace que este documento sirva para algo.
    const doc = new PDFDocument({ size: "A4", margin: 0, compress: false });
    const trozos = [];
    doc.on("data", (trozo) => trozos.push(trozo));
    doc.on("end", () => resolve(Buffer.concat(trozos)));
    doc.on("error", reject);

    const [ancho, alto] = A4;
    dibujarGuiasDeCorte(doc, A4);
    for (const [fx, fy] of COPIAS) {
      dibujarCuartilla(doc, datos, { x: ancho * fx, y: alto * fy, ancho: ancho / 2, alto: alto / 2 });
    }

    doc.end();
  });
}
