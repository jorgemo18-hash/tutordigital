// Cuerpo del email compartido por el envío por familia y el envío
// individual de informe: el texto de acompañamiento (ya sustituido) +
// footer LOPD, sin ningún detalle de recibo/informe (eso vive en los PDF
// adjuntos).
export function buildCuerpoHtml(cuerpo, textosLopd) {
  const lopd = textosLopd.length
    ? `<p style="font-size:11px;color:#999;margin-top:16px">${textosLopd.join(" ")}</p>`
    : "";
  return `<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;color:#333;white-space:pre-wrap">${cuerpo}</div>${lopd}`;
}

export function capitaliza(str) {
  return str ? str[0].toUpperCase() + str.slice(1) : str;
}
