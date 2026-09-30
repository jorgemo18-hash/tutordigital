// QUÉ MES VA EN CADA DOCUMENTO DEL ENVÍO MENSUAL A FAMILIAS.
//
// EL PROBLEMA (Jorge, 30/09/2026): *"el 5 de octubre mandaré el informe con
// lo que hemos hecho en septiembre, y como cobro a principios de mes, la
// factura de octubre"*. El envío juntaba recibo e informe DEL MISMO MES, así
// que su forma de trabajar no cabía en un solo correo: eligiendo octubre
// salía el informe de octubre (vacío); eligiendo septiembre, el recibo de
// septiembre (ya cobrado).
//
// DOS MODOS, NO COMBINACIONES LIBRES (decidido con Jorge el 30/09):
//   - "informe_mes_anterior": recibo del mes que empieza + informe del que
//     acaba. El de las academias que cobran por adelantado. Por defecto.
//   - "mismo_mes": recibo e informe del mismo mes. Para las que cobran a mes
//     vencido (y lo que hacía la app hasta ahora).
//
// EL MES DEL ENVÍO ES EL DEL RECIBO. Todo lo que se elige en "Envío a
// familias" es ese mes; el del informe se DEDUCE aquí y en ningún otro
// sitio. Lo importan el panel y el servidor: si cada uno restara un mes a
// su manera, el panel enseñaría un informe y el correo adjuntaría otro.
export const MODOS_ENVIO = ["informe_mes_anterior", "mismo_mes"];
export const MODO_ENVIO_POR_DEFECTO = "informe_mes_anterior";

const MESES = [
  null, "enero", "febrero", "marzo", "abril", "mayo", "junio",
  "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre",
];

export function modoDeEnvio(valor) {
  return MODOS_ENVIO.includes(valor) ? valor : MODO_ENVIO_POR_DEFECTO;
}

export function periodoDelInforme({ mes, anio }, modo) {
  if (modoDeEnvio(modo) === "mismo_mes") return { mes, anio };
  return mes === 1 ? { mes: 12, anio: anio - 1 } : { mes: mes - 1, anio };
}

// "Recibo de octubre · informe de septiembre": lo que se lee en la cabecera
// del envío para que nunca haya duda de qué va en el correo.
export function textoDelEnvio({ mes, anio }, periodoInforme) {
  const informe = periodoInforme || { mes, anio };
  const anioInforme = informe.anio !== anio ? ` de ${informe.anio}` : "";
  return `Recibo de ${MESES[mes]} · informe de ${MESES[informe.mes]}${anioInforme}`;
}
