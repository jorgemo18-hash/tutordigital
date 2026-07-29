import { escHtml } from "../../../assets/shared/js/escHtml.js";

// Cuerpo del email compartido por el envío por familia y el envío
// individual de informe: el texto de acompañamiento (ya sustituido) +
// footer LOPD, sin ningún detalle de recibo/informe (eso vive en los PDF
// adjuntos).
//
// `cuerpo` llega ya escapado (sustituirVariables() escapa {familia} y
// convierte \n -> <br> antes de devolverlo) — no se vuelve a tocar aquí,
// re-escaparlo entero doblaría el escapado de la parte que ya lo está.
// `textosLopd` (texto legal libre del admin, academia_textos_legales) SÍ
// se escapa aquí: esta función es su única frontera de interpolación
// HTML, no ha pasado por ningún escapado antes de llegar.
export function buildCuerpoHtml(cuerpo, textosLopd) {
  const lopd = textosLopd.length
    ? `<p style="font-size:11px;color:#999;margin-top:16px">${textosLopd.map(escHtml).join(" ")}</p>`
    : "";
  return `<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;color:#333;white-space:pre-wrap">${cuerpo}</div>${lopd}`;
}

export function capitaliza(str) {
  return str ? str[0].toUpperCase() + str.slice(1) : str;
}
