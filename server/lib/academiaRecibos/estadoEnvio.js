// Estado en el que queda un recibo después de enviarlo por email.
//
// Antes se escribía `estado: "enviado"` incondicionalmente. Reenviar un
// recibo YA COBRADO (permitido con confirmar:true, y también lo que hace
// "enviar al pagar") lo devolvía a "enviado" con la fecha_pago todavía
// puesta. Y como Finanzas › Ingresos decide si algo está cobrado mirando
// SOLO `estado` —nunca fecha_pago, ver ingresosConsultas.js—, un cobro que
// ya estaba en el banco desaparecía de la lista de pagados.
//
// Enviar es una notificación; cobrar es un hecho contable. Enviar no puede
// deshacer un cobro.
export function estadoTrasEnvio(estadoActual) {
  return estadoActual === "pagado" ? "pagado" : "enviado";
}
