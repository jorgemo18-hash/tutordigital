import { Resend } from "resend";

// Comprueba que un webhook viene de verdad de Resend.
//
// POR QUÉ ES OBLIGATORIO Y NO OPCIONAL: este endpoint no puede llevar
// sesión (lo llama Resend, no un navegador con token), así que su URL es
// pública. Sin firma, cualquiera que la adivine puede mandarnos
// `{"type":"email.bounced","data":{"email_id":"..."}}` y marcar como
// rebotados los recibos que quiera. La firma es lo ÚNICO que separa este
// endpoint de un panel de control abierto a internet.
//
// LA TRAMPA DEL SDK, que casi me come. `resend.webhooks.verify()` declara
// en sus tipos `headers: Headers`, lo que invita a pasarle el objeto de
// cabeceras de la petición. Su implementación real hace esto:
//
//     new Webhook(secret).verify(payload, {
//       "svix-id": payload.headers.id,
//       "svix-timestamp": payload.headers.timestamp,
//       "svix-signature": payload.headers.signature,
//     })
//
// Es decir: espera un objeto con las claves **`id`, `timestamp` y
// `signature`**, no las cabeceras `svix-*`. Pasarle las cabeceras tal cual
// no da error de tipos ni excepción clara: las tres llegan `undefined` y la
// verificación falla siempre. Es el mismo tipo de fallo silencioso que el
// `reply_to` (commit abdbf5dd): una clave que no se lee y nadie protesta.
// Por eso el mapeo se hace aquí, explícito, con un test que lo fija.
//
// Y OTRA COSA: `verify()` LANZA cuando la firma no cuadra, no devuelve
// false. Se captura y se traduce a un resultado, para que la ruta no tenga
// que distinguir entre "firma mala" y "se cayó algo".

// La verificación NO usa la clave de API — solo el secreto del webhook —
// pero el constructor del SDK exige una clave. Se le pasa una de relleno a
// propósito: así este módulo funciona en un proceso que no envíe emails, y
// no hay ninguna clave real en juego al validar una petición de fuera.
const CLAVE_DE_RELLENO = "re_no_se_usa_para_verificar";
let sdk = null;
function verificarConElSdk(opciones) {
  if (!sdk) sdk = new Resend(process.env.RESEND_API_KEY || CLAVE_DE_RELLENO);
  return sdk.webhooks.verify(opciones);
}

// Lee las tres cabeceras que firma Resend (vía Svix). Se aceptan también
// sin el prefijo `svix-` porque algunos proxies las reescriben como
// `webhook-*` (el estándar "Standard Webhooks" usa esos nombres).
export function cabecerasDeFirma(headers = {}) {
  const leer = (...nombres) => {
    for (const n of nombres) {
      const v = headers[n] ?? headers[n.toLowerCase()];
      if (v) return String(Array.isArray(v) ? v[0] : v);
    }
    return "";
  };
  return {
    id: leer("svix-id", "webhook-id"),
    timestamp: leer("svix-timestamp", "webhook-timestamp"),
    signature: leer("svix-signature", "webhook-signature"),
  };
}

// `cuerpoCrudo` tiene que ser el texto EXACTO que llegó, byte a byte. Si se
// parsea y se vuelve a serializar, el orden de las claves o un espacio
// cambian y la firma ya no cuadra. De ahí el parser de cuerpo propio de la
// ruta (ver routes/v1/webhooks/resend.routes.js).
//
// Devuelve `{ ok, evento, motivo }`. Nunca lanza.
export function verificarWebhookResend({ cuerpoCrudo, headers, secreto, verifyFn } = {}) {
  if (!secreto) return { ok: false, motivo: "webhook_secret_no_configurado" };
  if (typeof cuerpoCrudo !== "string" || !cuerpoCrudo) return { ok: false, motivo: "cuerpo_vacio" };

  const firma = cabecerasDeFirma(headers);
  if (!firma.id || !firma.timestamp || !firma.signature) {
    return { ok: false, motivo: "faltan_cabeceras_de_firma" };
  }

  const verificar = verifyFn || verificarConElSdk;
  try {
    const evento = verificar({ payload: cuerpoCrudo, headers: firma, webhookSecret: secreto });
    if (!evento || typeof evento !== "object") return { ok: false, motivo: "evento_no_valido" };
    return { ok: true, evento, svixId: firma.id };
  } catch (err) {
    // No se devuelve el mensaje de la librería hacia fuera: a quien llama
    // sin firma válida no se le explica por qué no cuela. Se registra en el
    // log de la ruta y punto.
    return { ok: false, motivo: "firma_no_valida", detalle: err?.message || "" };
  }
}
