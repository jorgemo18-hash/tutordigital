// LOS ESTADOS DE ENTREGA DE UN EMAIL, en un solo sitio.
//
// Este módulo lo comparten el backend (que los escribe al recibir un
// webhook de Resend) y el panel (que los pinta). Está aquí, en
// assets/shared, por el mismo motivo que preciosPublicos.js o
// horarioReservas.js: en cuanto el servidor y la pantalla tienen cada uno su
// propia idea de qué cuenta como "no llegó", se separan sin que nadie se
// entere, y el resultado es un recibo que la app da por entregado y la
// familia no ha recibido.
//
// Los valores tienen que coincidir con el CHECK de `academia_envios_email`
// (migración 122). Si se añade uno, va en los dos sitios.

// Orden de gravedad, de menos a más. Es lo que decide si un webhook que
// llega tarde puede pisar el estado que ya había: los avisos de Resend NO
// llegan en orden, y un 'delivered' retrasado no puede borrar un rebote.
export const GRAVEDAD_ENTREGA = {
  enviado: 0,    // aceptado por la API, sin noticias todavía
  retrasado: 1,  // reintentando en el servidor de destino
  entregado: 2,  // llegó al buzón
  suprimido: 3,  // ni se intentó: la dirección está en lista de bloqueo
  queja: 4,      // llegó, y la marcaron como spam
  fallido: 5,    // no se pudo enviar
  rebotado: 6,   // rechazado por el servidor de destino
};

// LA FRONTERA: de aquí hacia arriba, el email NO está en el buzón de la
// familia. Es la línea que separa "todo bien" de "esto hay que mirarlo", y
// la que decide qué se pinta en rojo en el panel de envío.
export const PRIMER_ESTADO_PROBLEMA = GRAVEDAD_ENTREGA.suprimido;

export function esProblemaDeEntrega(estado) {
  const nivel = GRAVEDAD_ENTREGA[String(estado || "")];
  return nivel !== undefined && nivel >= PRIMER_ESTADO_PROBLEMA;
}

// Si un estado nuevo debe reemplazar al que ya estaba guardado.
//
// Las dos reglas, y la segunda es la que de verdad importa:
//   - un problema pisa cualquier estado sano, y a otro problema solo si es
//     más grave (un 'rebotado' no se degrada a 'queja' porque la queja
//     llegue después);
//   - un estado sano NUNCA pisa un problema ya registrado. Sin esto, un
//     'delivered' que llega con retraso borraría el rebote y la familia
//     desaparecería de la lista de problemas sin haber recibido nada.
export function debeReemplazarEstado(actual, nuevo) {
  if (!nuevo || nuevo === actual) return false;
  if (esProblemaDeEntrega(nuevo)) {
    return !esProblemaDeEntrega(actual) || GRAVEDAD_ENTREGA[nuevo] > GRAVEDAD_ENTREGA[actual];
  }
  if (esProblemaDeEntrega(actual)) return false;
  return (GRAVEDAD_ENTREGA[nuevo] ?? 0) > (GRAVEDAD_ENTREGA[actual] ?? 0);
}
