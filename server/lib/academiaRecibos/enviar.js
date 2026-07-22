import { fetchReciboCompleto } from "./consultas.js";
import { enviarReciboYInformesDeFamilia } from "../academiaEnvio/enviarFamiliaEmail.js";

// Envía el recibo de una familia (+ los informes de sus alumnos activos ya
// generados, en el mismo email — ver enviarFamiliaEmail.js). Se mantiene
// esta firma por reciboId (no familiaId) porque así la usan sus 3
// llamadores (enviar.routes.js ×2, marcarPago.js) — internamente solo
// resuelve la familia y delega en el orquestador compartido.
export async function enviarReciboPorId(admin, { tenantId, reciboId, tenantNombre, pdfServiceUrl }) {
  const { data: recibo, error } = await fetchReciboCompleto(admin, tenantId, reciboId);
  if (error) return { ok: false, code: "fetch_failed", motivo: "No se pudo leer el recibo." };
  if (!recibo) return { ok: false, code: "not_found", motivo: "Recibo no encontrado." };

  return enviarReciboYInformesDeFamilia(admin, {
    tenantId, tenantNombre, familiaId: recibo.familia_id, mes: recibo.mes, anio: recibo.anio, pdfServiceUrl,
  });
}
