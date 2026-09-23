// POR QUÉ NO LLEGÓ UN CORREO, EN CASTELLANO.
//
// Jorge, 23/09/2026, señalando el aviso de una familia: *"¿qué significa
// esto? ¿podríamos hacer que esos mensajes salgan en castellano?"*. Lo que
// veía era el texto de Resend tal cual: "The recipient's email provider sent
// a bounce message because the recipient's inbox was full… · Transient ·
// MailboxFull".
//
// SE TRADUCE AL PINTAR, NO AL GUARDAR. En la base de datos el motivo sigue
// siendo el del proveedor (`motivoDeEvento` en server/lib/academiaEmailEventos
// /aplicarEvento.js), y eso tiene dos ventajas: los avisos que YA estaban
// guardados en inglés salen traducidos sin tocar ninguna fila, y el texto
// original sigue ahí para cuando haya que discutir un rebote con el soporte
// de Resend.
//
// DE DÓNDE SALE LA LISTA. De la documentación de Resend sobre rebotes
// (resend.com/docs/dashboard/emails/email-bounces), no de memoria: tres
// tipos —Permanent, Transient, Undetermined— y sus subtipos. Son los mismos
// que usa Amazon SES, que es lo que Resend tiene debajo.
//
// LO QUE IMPORTA NO ES TRADUCIR, ES DECIR QUÉ HACER. "Rebote transitorio" en
// castellano sigue sin decir nada. Cada caso dice si hay que corregir el
// email o basta con volver a intentarlo, porque son dos acciones opuestas y
// hacer la equivocada no sirve: reenviar a una dirección que no existe
// rebota otra vez, y cambiar el email de una familia porque tenía el buzón
// lleno estropea un dato que estaba bien.

// `corto` va en la fila (unos 40 caracteres caben). `explicacion` va en el
// aviso al pasar el ratón, y termina siempre diciendo qué hacer.
const POR_SUBTIPO = {
  MailboxFull: {
    corto: "buzón lleno (temporal)",
    explicacion: "El buzón de correo de la familia estaba lleno. No es un problema de la dirección: "
      + "vuelve a enviarlo dentro de unos días, cuando lo hayan vaciado.",
  },
  MessageTooLarge: {
    corto: "correo demasiado grande",
    explicacion: "Su proveedor de correo lo rechazó por tamaño, normalmente por los PDF adjuntos. "
      + "La dirección está bien: prueba a enviar el recibo y el informe por separado.",
  },
  ContentRejected: {
    corto: "contenido rechazado",
    explicacion: "Su proveedor de correo rechazó el contenido del mensaje. La dirección está bien; "
      + "si se repite, pídele a la familia que añada a la academia a sus contactos.",
  },
  AttachmentRejected: {
    corto: "adjunto rechazado",
    explicacion: "Su proveedor de correo no admitió el archivo adjunto. La dirección está bien; "
      + "si se repite, habrá que mandarle el documento por otra vía.",
  },
  NoEmail: {
    corto: "dirección no válida",
    explicacion: "La dirección de correo de la familia no es válida. Hay que corregirla en su "
      + "ficha: volver a enviar a la misma dirección no servirá.",
  },
  // ESTOS DOS NO ESTÁN EN LA PÁGINA DE REBOTES DE RESEND, y lo digo para no
  // hacerlos pasar por documentados: son subtipos de Amazon SES, que es lo
  // que Resend usa por debajo, y Resend tiene lista de supresión. Si nunca
  // llegan, no estorban; si llegan, mejor traducidos que en inglés.
  Suppressed: {
    corto: "bloqueada tras rebotar",
    explicacion: "Resend ya no envía a esta dirección porque rebotó antes de forma permanente. "
      + "Hay que corregir el email de la familia en su ficha.",
  },
  OnAccountSuppressionList: {
    corto: "bloqueada tras rebotar",
    explicacion: "Resend ya no envía a esta dirección porque rebotó antes de forma permanente. "
      + "Hay que corregir el email de la familia en su ficha.",
  },
};

// Cuando el subtipo no dice nada propio ("General") o no se conoce, manda el
// tipo. Es la distinción que de verdad decide qué hacer.
const POR_TIPO = {
  Permanent: {
    corto: "la dirección no existe",
    explicacion: "El proveedor de correo de la familia dice que esa dirección no existe o no "
      + "acepta correo. Hay que corregir el email en su ficha: volver a enviar no servirá.",
  },
  Transient: {
    corto: "rechazo temporal",
    explicacion: "Su proveedor de correo lo rechazó de forma temporal. La dirección está bien: "
      + "vuelve a enviarlo más adelante.",
  },
  Undetermined: {
    corto: "motivo desconocido",
    explicacion: "El proveedor de correo lo devolvió sin decir por qué. Comprueba con la familia "
      + "que el email de su ficha es el correcto.",
  },
};

const TIPOS = new Set(Object.keys(POR_TIPO));

// El motivo se guarda como "mensaje · tipo · subtipo" (ver motivoDeEvento).
// Se buscan el tipo y el subtipo entre las piezas en vez de por posición:
// los eventos de supresión solo traen "mensaje · tipo", y un motivo de
// `email.failed` es una frase suelta sin ninguno de los dos.
function piezasDe(motivo) {
  const partes = String(motivo || "").split(" · ").map((p) => p.trim()).filter(Boolean);
  const tipo = partes.find((p) => TIPOS.has(p)) || null;
  const subtipo = partes.find((p) => Object.hasOwn(POR_SUBTIPO, p)) || null;
  const general = partes.includes("General");
  return { tipo, subtipo, general };
}

// Devuelve `{ corto, explicacion, tecnico }`, o `null` si el motivo no se
// reconoce. Con `null` la pantalla enseña el texto original: un motivo que
// no sabemos traducir es mejor leerlo en inglés que no leerlo.
export function explicarMotivoEntrega(motivo) {
  const { tipo, subtipo, general } = piezasDe(motivo);
  const traduccion = (subtipo && POR_SUBTIPO[subtipo]) || (tipo && POR_TIPO[tipo]) || null;
  if (!traduccion) return null;
  // Lo técnico va aparte y corto: es para el soporte, no para Jorge. Se
  // guarda la clasificación, no la frase inglesa entera, que ya está
  // traducida en la explicación.
  const tecnico = [tipo, subtipo || (general ? "General" : null)].filter(Boolean).join(" · ");
  return { ...traduccion, tecnico };
}
