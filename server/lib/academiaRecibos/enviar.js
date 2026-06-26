import { buildReciboHtml } from "./plantillaEmail.js";
import { sendReciboEmail } from "../email.js";
import { fetchReciboCompleto } from "./consultas.js";

// Envía un recibo ya generado: construye el HTML, lo manda por Resend y
// marca estado=enviado. La usan tanto el envío individual como el masivo,
// para no duplicar esta lógica entre ambas rutas.
export async function enviarReciboPorId(admin, { tenantId, reciboId, tenantNombre, config }) {
  const { data: recibo, error } = await fetchReciboCompleto(admin, tenantId, reciboId);
  if (error) return { ok: false, code: "fetch_failed", motivo: "No se pudo leer el recibo." };
  if (!recibo) return { ok: false, code: "not_found", motivo: "Recibo no encontrado." };
  if (!recibo.familia?.email) {
    return {
      ok: false,
      code: "sin_email",
      motivo: "La familia no tiene email configurado.",
      familiaNombre: recibo.familia?.nombre || "",
    };
  }

  const html = buildReciboHtml({ recibo, familia: recibo.familia, lineas: recibo.lineas, config, tenantNombre });
  try {
    await sendReciboEmail({ to: recibo.familia.email, subject: `${recibo.concepto} — ${tenantNombre}`, html });
  } catch (err) {
    return { ok: false, code: "send_failed", motivo: err.message || "Fallo al enviar el email.", familiaNombre: recibo.familia.nombre };
  }

  const { error: updateErr } = await admin
    .from("academia_recibos")
    .update({ estado: "enviado", fecha_envio: new Date().toISOString() })
    .eq("id", reciboId)
    .eq("tenant_id", tenantId);
  if (updateErr) {
    return { ok: false, code: "update_failed", motivo: "El email se envió pero no se pudo actualizar el estado.", familiaNombre: recibo.familia.nombre };
  }
  return { ok: true };
}
