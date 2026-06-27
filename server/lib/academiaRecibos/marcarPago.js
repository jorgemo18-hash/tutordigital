import { enviarReciboPorId } from "./enviar.js";

// Si el recibo todavía no se había enviado nunca y la academia tiene
// activado "enviar al pagar" (Ajustes › Facturación), se envía primero
// (eso deja estado=enviado/fecha_envio) y LUEGO se sobrescribe a pagado —
// el orden importa porque enviarReciboPorId también escribe `estado`.
export async function marcarReciboPagado(admin, { tenantId, reciboId, tenantNombre, config, textosLopd, textosExencion }) {
  const { data: recibo, error: fetchErr } = await admin
    .from("academia_recibos")
    .select("id, estado")
    .eq("id", reciboId)
    .eq("tenant_id", tenantId)
    .maybeSingle();
  if (fetchErr) return { ok: false, motivo: "No se pudo leer el recibo." };
  if (!recibo) return { ok: false, motivo: "Recibo no encontrado." };

  const yaEnviado = recibo.estado !== "borrador";
  if (config?.enviar_recibo_al_pagar && !yaEnviado) {
    const envio = await enviarReciboPorId(admin, { tenantId, reciboId, tenantNombre, config, textosLopd, textosExencion });
    if (!envio.ok) return { ok: false, motivo: envio.motivo || "No se pudo enviar el recibo." };
  }

  const hoy = new Date().toISOString().slice(0, 10);
  const { error: updateErr } = await admin
    .from("academia_recibos")
    .update({ estado: "pagado", fecha_pago: hoy })
    .eq("id", reciboId)
    .eq("tenant_id", tenantId);
  if (updateErr) return { ok: false, motivo: "No se pudo marcar como pagado." };
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
