// EL CUADRANTE SEMANAL EN PDF: A4 horizontal, una hoja.
//
// POR QUÉ UN PDF DE VERDAD Y NO Cmd+P (Jorge, 16/09/2026, después de tres
// intentos de que la impresión del navegador cupiera en un folio):
//
// Imprimiendo la página, el folio no es nuestro. Safari ignora `@page` —ni el
// tamaño ni los márgenes—, los pone la impresora, y la escala del diálogo
// cambia la geometría DESPUÉS de que la página haya medido. Así que elegir el
// tamaño de letra desde el navegador es un cálculo a ciegas sobre un papel que
// no se ve: salían dos, tres y cuatro folios según el ajuste. Aquí el reparto
// está escrito en puntos y sale igual en cualquier impresora y navegador, y la
// orientación viaja DENTRO del archivo, así que no hay diálogo que la cambie.
//
// Es exactamente el mismo razonamiento que ya estaba escrito en la hoja para
// familias (generarHojaFamilias.js) y que en su día no apliqué aquí: si el
// documento TIENE que caer en el folio, se dibuja; si da igual que ocupe dos
// páginas, vale Cmd+P.
//
// Con pdfkit en el propio backend —como la hoja de familias y el listado de
// fichajes— y NO con el microservicio de PDF de Render: aquí no hay nada que
// renderizar con LibreOffice, son rectángulos y texto, del orden de
// milisegundos.

import PDFDocument from "pdfkit";
import { dibujarCuadrante } from "./tablaCuadrantePdf.js";

// A4 horizontal en puntos. Margen de 28pt ≈ 10mm, que entra en las zonas
// imprimibles de cualquier impresora doméstica.
const MARGEN = 28;
const ALTO_CABECERA = 34;

const MESES = [
  "enero", "febrero", "marzo", "abril", "mayo", "junio",
  "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre",
];

export function textoFecha(fecha = new Date()) {
  return `Impreso el ${fecha.getDate()} de ${MESES[fecha.getMonth()]} de ${fecha.getFullYear()}`;
}

// La cabecera de papel. Un cuadrante colgado en una pared sin fecha no se sabe
// si está vigente, y sin el nombre del centro no se sabe de quién es en cuanto
// hay dos academias.
function dibujarCabeceraDePapel(doc, { titulo, centro, fecha, ancho }) {
  const y = MARGEN;
  doc.font("Helvetica-Bold").fontSize(13).fillColor("#000000");
  doc.text(titulo, MARGEN, y, { width: ancho * 0.7 });
  if (centro) {
    doc.font("Helvetica").fontSize(9.5).fillColor("#333333");
    doc.text(centro, MARGEN, y + 16, { width: ancho * 0.7 });
  }
  doc.font("Helvetica").fontSize(8.5).fillColor("#555555");
  doc.text(textoFecha(fecha), MARGEN, y + 4, { width: ancho, align: "right" });

  doc.save().lineWidth(0.8).strokeColor("#000000")
    .moveTo(MARGEN, y + ALTO_CABECERA - 6).lineTo(MARGEN + ancho, y + ALTO_CABECERA - 6).stroke().restore();
}

// `datos` es el contrato de filasDelCuadrante() más el título y el centro.
// Devuelve un Buffer; la ruta lo manda tal cual, sin escribir a disco.
export function buildCuadrantePdfBuffer({
  columnas = [],
  filas = [],
  titulo = "Horario semanal",
  centro = "",
  fecha = new Date(),
} = {}) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: "A4", layout: "landscape", margin: MARGEN, autoFirstPage: true });
    const trozos = [];
    doc.on("data", (t) => trozos.push(t));
    doc.on("end", () => resolve(Buffer.concat(trozos)));
    doc.on("error", reject);

    try {
      const ancho = doc.page.width - MARGEN * 2;
      dibujarCabeceraDePapel(doc, { titulo, centro, fecha, ancho });

      const arriba = MARGEN + ALTO_CABECERA;
      if (!filas.length) {
        doc.font("Helvetica").fontSize(11).fillColor("#000000");
        doc.text("No hay franjas configuradas para este horario.", MARGEN, arriba + 10);
      } else {
        dibujarCuadrante(doc, {
          columnas,
          filas,
          x: MARGEN,
          y: arriba,
          ancho,
          // La segunda página y siguientes no llevan cabecera de papel, así que
          // aprovechan el folio entero. Se reparte contra el alto de la
          // PRIMERA, que es la más apretada: así ninguna se pasa.
          alto: doc.page.height - arriba - MARGEN,
          nuevaPagina: () => {
            doc.addPage({ size: "A4", layout: "landscape", margin: MARGEN });
            return MARGEN;
          },
        });
      }
      doc.end();
    } catch (err) {
      reject(err);
    }
  });
}
