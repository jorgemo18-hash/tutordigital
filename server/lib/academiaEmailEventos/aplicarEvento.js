import { debeReemplazarEstado } from "../../../assets/shared/js/estadosEntrega.js";

// Qué hacemos con un evento de Resend ya verificado.
//
// Dos escrituras y en este orden:
//   1) guardar el evento (histórico, idempotente por `svix_id`);
//   2) actualizar el estado del envío al que se refiere.
//
// El orden importa: si se cae entre las dos, queda el evento guardado y el
// estado sin actualizar — recuperable, porque el evento está. Al revés
// habríamos perdido la única copia de lo que nos contaron.

// De tipo de evento a estado del envío. Solo se traducen los que dicen algo
// sobre si el email llegó; el resto (opened, clicked) se guardan en el
// histórico pero NO tocan el estado.
//
// `email.sent` tampoco lo toca: es lo que ya sabíamos al aceptar el envío,
// y sobrescribir un 'entregado' con 'enviado' porque los webhooks lleguen
// desordenados sería un paso atrás. Los webhooks NO llegan en orden.
const ESTADO_POR_EVENTO = {
  "email.delivered": "entregado",
  "email.bounced": "rebotado",
  "email.complained": "queja",
  "email.failed": "fallido",
  "email.delivery_delayed": "retrasado",
  "email.suppressed": "suprimido",
};

export function estadoDeEvento(tipo) {
  return ESTADO_POR_EVENTO[tipo] || null;
}

// Reexportado para no cambiar la firma que ya usan los tests y la ruta: la
// regla vive en assets/shared (la comparte el panel, ver estadoFamilia.js).
export { debeReemplazarEstado };

// El texto que explica el problema. Es lo que verá Jorge, así que se coge el
// mensaje del proveedor tal cual: "Recipient address does not exist" dice
// mucho más que "rebotado".
//
// EL MENSAJE VA PRIMERO, y eso NO es cosmético. En la fila del panel el
// motivo se recorta a unos 40 caracteres, y con el orden de Resend
// (`type · subType · message`) lo que se leía era
// "Permanent · General · Recipient address d…": la clasificación interna del
// proveedor entera, y cortado justo antes de lo único que dice qué hacer.
// Se descubrió pintando la fila y mirándola, no en un test.
//
// La clasificación no se tira: va detrás, y en el panel se ve completa al
// pasar el ratón por encima (el `title` de la fila).
export function motivoDeEvento(evento) {
  const d = evento?.data || {};
  if (d.bounce) return [d.bounce.message, d.bounce.type, d.bounce.subType].filter(Boolean).join(" · ");
  if (d.failed?.reason) return String(d.failed.reason);
  if (d.suppressed) return [d.suppressed.message, d.suppressed.type].filter(Boolean).join(" · ");
  return null;
}

// `admin`: cliente con service role. `evento`: el objeto ya VERIFICADO.
//
// Devuelve `{ ok, duplicado, envioId, estado }`. No lanza: la ruta tiene
// que contestar 2xx a Resend siempre que la firma sea válida, porque un
// error nuestro provoca reintentos eternos del mismo evento.
export async function aplicarEventoResend(admin, { evento, svixId = null } = {}) {
  const tipo = String(evento?.type || "");
  const emailId = String(evento?.data?.email_id || "");
  if (!tipo || !emailId) return { ok: false, motivo: "evento_sin_tipo_o_email_id" };

  // El envío se busca ANTES de insertar el evento para poder enlazarlos.
  // Puede no existir (email de antes de la migración 122, o de soporte): en
  // ese caso el evento se guarda huérfano, con su `resend_email_id`, en vez
  // de tirarlo.
  const { data: envio } = await admin
    .from("academia_envios_email")
    .select("id, estado")
    .eq("resend_email_id", emailId)
    .maybeSingle();

  const motivo = motivoDeEvento(evento);
  const { error: eventoErr } = await admin
    .from("academia_email_eventos")
    .insert({
      envio_id: envio?.id || null,
      resend_email_id: emailId,
      svix_id: svixId,
      tipo,
      ocurrido_at: evento?.created_at || null,
      motivo,
      payload: evento,
    });

  // 23505 = clave duplicada: es un REINTENTO del mismo evento, no un fallo.
  // Resend reenvía hasta que contestamos 2xx, así que esto pasará de verdad.
  if (eventoErr && eventoErr.code === "23505") {
    return { ok: true, duplicado: true, envioId: envio?.id || null };
  }
  if (eventoErr) return { ok: false, motivo: "no_se_pudo_guardar_el_evento", error: eventoErr };

  const estado = estadoDeEvento(tipo);
  if (!envio || !debeReemplazarEstado(envio.estado, estado)) {
    return { ok: true, duplicado: false, envioId: envio?.id || null, estado: null };
  }

  const { error: updErr } = await admin
    .from("academia_envios_email")
    .update({ estado, motivo, estado_at: evento?.created_at || new Date().toISOString() })
    .eq("id", envio.id);
  if (updErr) return { ok: false, motivo: "no_se_pudo_actualizar_el_envio", error: updErr, envioId: envio.id };

  return { ok: true, duplicado: false, envioId: envio.id, estado };
}
