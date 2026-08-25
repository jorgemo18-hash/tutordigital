import { enviarReciboPorId } from "./enviar.js";

// Cobrar y notificar son dos operaciones distintas, y el cobro manda.
//
// Antes, con "enviar al pagar" activado (Ajustes › Facturación), esta
// función enviaba PRIMERO y salía sin escribir nada si el envío fallaba:
// con el microservicio de PDF dormido o caído, el admin no podía registrar
// un pago que ya tenía en el banco. El checkbox de Finanzas se revertía
// solo y no había forma de apuntarlo.
//
// Ahora se marca el pago siempre, y el envío se intenta después como
// efecto secundario: si falla, el pago queda registrado igualmente y se
// devuelve `avisoEnvio` para que la interfaz lo diga en vez de fingir que
// todo fue bien. El envío ya no puede degradar el estado a "enviado"
// porque enviarFamiliaEmail preserva "pagado" (ver estadoEnvio.js), así
// que el orden puede invertirse sin perder el cobro.
export async function marcarReciboPagado(admin, { tenantId, reciboId, tenantNombre, pdfServiceUrl, enviarAlPagar, enviarReciboPorIdFn = enviarReciboPorId }) {
  const { data: recibo, error: fetchErr } = await admin
    .from("academia_recibos")
    .select("id, estado")
    .eq("id", reciboId)
    .eq("tenant_id", tenantId)
    .maybeSingle();
  if (fetchErr) return { ok: false, motivo: "No se pudo leer el recibo." };
  if (!recibo) return { ok: false, motivo: "Recibo no encontrado." };

  // Se calcula ANTES del UPDATE: después, estado ya sería "pagado" y
  // "nunca se envió" se perdería.
  const yaEnviado = recibo.estado !== "borrador";

  const hoy = new Date().toISOString().slice(0, 10);
  const { error: updateErr } = await admin
    .from("academia_recibos")
    .update({ estado: "pagado", fecha_pago: hoy })
    .eq("id", reciboId)
    .eq("tenant_id", tenantId);
  if (updateErr) return { ok: false, motivo: "No se pudo marcar como pagado." };

  if (enviarAlPagar && !yaEnviado) {
    // confirmar:true porque el recibo acaba de quedar en "pagado" y la
    // política forward-only (confirmacionEnvioFamilia.js) bloquearía el
    // envío por considerarlo un reenvío. Aquí no lo es: es el primer envío,
    // pedido explícitamente por la configuración del centro.
    const envio = await enviarReciboPorIdFn(admin, { tenantId, reciboId, tenantNombre, pdfServiceUrl, confirmar: true });
    if (!envio.ok) {
      return { ok: true, avisoEnvio: envio.motivo || "No se pudo enviar el recibo a la familia." };
    }
  }

  return { ok: true };
}

// Revierte a "enviado" si alguna vez se envió, o a "borrador" si no —
// nunca deja un recibo marcado como enviado sin fecha_envio real.
export async function marcarReciboPendiente(admin, { tenantId, reciboId }) {
  const { data: recibo, error: fetchErr } = await admin
    .from("academia_recibos")
    .select("id, fecha_envio")
    .eq("id", reciboId)
    .eq("tenant_id", tenantId)
    .maybeSingle();
  if (fetchErr) return { ok: false, motivo: "No se pudo leer el recibo." };
  if (!recibo) return { ok: false, motivo: "Recibo no encontrado." };

  const estado = recibo.fecha_envio ? "enviado" : "borrador";
  const { error: updateErr } = await admin
    .from("academia_recibos")
    .update({ estado, fecha_pago: null })
    .eq("id", reciboId)
    .eq("tenant_id", tenantId);
  if (updateErr) return { ok: false, motivo: "No se pudo revertir el estado." };
  return { ok: true };
}
