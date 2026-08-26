// Quién firma los emails que salen hacia las familias.
//
// Hasta ahora TODO salía como "TutorDigital <noreply@tutordigital.app>" y
// sin dirección de respuesta: la familia recibía el recibo de su academia
// firmado por una marca que no conoce, y si le daba a Responder el mensaje
// se perdía. Para una academia que factura por email eso no es un detalle
// estético — es la vía por la que la familia pregunta "esto qué es".
//
// LO QUE NO SE PUEDE HACER, y por qué:
// el `from` NO puede ser la dirección de la academia (p. ej. una de Gmail).
// Resend solo acepta enviar desde un dominio verificado en la cuenta, y
// ningún centro va a verificar tutordigital.app ni nosotros su Gmail; un
// `from` arbitrario lo rechaza la API entera con `invalid_from_address` y
// el envío falla. Así que la dirección sigue siendo la nuestra y lo que
// cambia es:
//   - el NOMBRE visible, que pasa a ser el del centro ("Lyceo <noreply@…>"),
//     que es lo que el cliente de correo enseña en la bandeja;
//   - el `reply_to`, que sí puede ser cualquier dirección y es el que hace
//     que Responder llegue a la academia.
//
// Todo lo de aquí es cosmético frente al envío: si el nombre o el email del
// centro están mal, se ignoran y el email sale igual con los valores de
// siempre. Un campo mal escrito en Ajustes no puede tumbar el envío de los
// recibos del mes.

export const REMITENTE_EMAIL = "noreply@tutordigital.app";
export const REMITENTE_NOMBRE_POR_DEFECTO = "TutorDigital";

// Un nombre visible sin \r ni \n. Sin esto, un salto de línea guardado en
// `nombre_emisor` se colaría tal cual en una cabecera SMTP y permitiría
// inyectar cabeceras (un Bcc, por ejemplo). No es paranoia: el campo lo
// escribe el admin del centro a mano y viaja sin escapar hasta la API.
const CONTROL_RE = /[\r\n\t\u0000-\u001f\u007f]/g;

// Formato "single address" y nada más: un @, algo a cada lado, un punto en
// el dominio y ni espacios ni comas (que separarían direcciones). No
// pretende validar según RFC — pretende no romper la cabecera.
const EMAIL_RE = /^[^\s@,;<>]+@[^\s@,;<>]+\.[^\s@,;<>]{2,}$/;

// El nombre va SIEMPRE entre comillas: así una coma o un punto en el
// nombre del centro ("Academia Ruiz, S.L.") no se interpreta como
// separador de direcciones. Dentro de las comillas solo estorban la
// comilla y la barra invertida, que se quitan.
export function limpiarNombreRemitente(nombre) {
  const limpio = String(nombre ?? "")
    .replace(CONTROL_RE, " ")
    .replace(/["\\]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 78); // límite práctico de línea de cabecera
  return limpio || REMITENTE_NOMBRE_POR_DEFECTO;
}

// Devuelve la dirección solo si es utilizable; null si no. Se prefiere
// perder el reply_to a mandar a Resend algo que rechace todo el envío.
export function limpiarEmailRespuesta(email) {
  const limpio = String(email ?? "").replace(CONTROL_RE, "").trim();
  return EMAIL_RE.test(limpio) ? limpio : null;
}

// `config`: fila de academia_config (nombre_emisor, email_emisor).
// `tenantNombre`: nombre del centro, como respaldo cuando el centro no ha
// rellenado "Nombre del emisor" — misma precedencia que ya usa el panel
// (ver envioFamiliasSection.js) para que la bandeja y la pantalla digan lo
// mismo.
//
// Devuelve `{ from, replyTo }` con `replyTo` null si no hay dirección
// válida; quien envía decide si lo incluye.
export function buildRemitente(config = {}, tenantNombre = "") {
  const nombre = limpiarNombreRemitente(config?.nombre_emisor || tenantNombre);
  return {
    from: `"${nombre}" <${REMITENTE_EMAIL}>`,
    replyTo: limpiarEmailRespuesta(config?.email_emisor),
  };
}
