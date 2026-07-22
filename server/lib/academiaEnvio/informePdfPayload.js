// Payload que espera el endpoint POST /informe de tutordigital-pdf-service
// (ver generators/informe.py) — compartido por el envío individual
// (enviarInformeIndividual.js) y el envío combinado por familia
// (enviarFamiliaEmail.js), que ya no pasan `emailDestino` ni `recibo`: el
// microservicio solo genera el PDF y lo devuelve, el envío del email lo
// hace Node.
export function buildInformePdfPayload({ alumno, mes, anio, dias, comentario, academiaPayload }) {
  return {
    alumno: { nombre: alumno.nombre, curso: alumno.curso || "" },
    mes,
    anio,
    diasMes: dias,
    comentario,
    academia: academiaPayload,
  };
}
