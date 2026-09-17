// Deja constancia de un email que ya ha salido.
//
// Por qué existe este archivo y no una línea dentro del envío: lo que se
// escribe aquí es la ÚNICA forma de emparejar después un webhook de Resend
// ("este email rebotó") con el recibo y la familia a los que corresponde.
// El emparejamiento se hace por `resend_email_id` (ver migración 122).
//
// REGLA DE ORO DE TODO ESTE MÓDULO: **el email ya se ha enviado**. Nada de
// lo que pase aquí puede deshacerlo, así que nada de lo que pase aquí puede
// romper el envío. Si el registro falla, se avisa y se sigue. Un recibo que
// llegó a la familia pero no quedó registrado es un problema menor; una
// excepción aquí que abortara la tanda de recibos del mes, no.

// `admin`: cliente de Supabase con service role (estas tablas no se
// escriben desde el navegador, ver las políticas de la migración 122).
//
// Devuelve `{ envioId, error }`. El error se devuelve, NO se lanza.
export async function registrarEnvioEmail(admin, {
  tenantId,
  resendEmailId,
  destinatario,
  asunto = null,
  familiaId = null,
  reciboId = null,
  tipo = "otro",
} = {}) {
  // Sin id de Resend no hay nada que registrar: una fila sin la clave de
  // unión no sirve para lo único que esta tabla hace. Mejor no escribirla
  // que llenar la tabla de filas que nunca se podrán casar con un evento.
  if (!resendEmailId) return { envioId: null, error: null, omitido: true };
  if (!tenantId || !destinatario) return { envioId: null, error: null, omitido: true };

  const { data, error } = await admin
    .from("academia_envios_email")
    .insert({
      tenant_id: tenantId,
      resend_email_id: resendEmailId,
      destinatario,
      asunto,
      familia_id: familiaId,
      recibo_id: reciboId,
      tipo,
    })
    .select("id")
    .maybeSingle();

  if (error) return { envioId: null, error };
  return { envioId: data?.id || null, error: null };
}

// Qué tipo de envío es, a partir de lo que se ha adjuntado. Se calcula
// aquí y no en quien envía para que el vocabulario de la columna `tipo`
// (y su CHECK) viva junto a la función que escribe en ella.
export function tipoDeEnvio({ hayRecibo = false, hayInformes = false } = {}) {
  if (hayRecibo && hayInformes) return "recibo_informe";
  if (hayRecibo) return "recibo";
  if (hayInformes) return "informe";
  return "otro";
}
