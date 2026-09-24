import { callJson } from "./apiCore.js";

// El historial de los recibos de una familia en un mes (migración 134).
// Devuelve { eventos, recuperable }.
export async function fetchHistorialRecibos({ familia_id, mes, anio }) {
  const qs = new URLSearchParams({ familia_id, mes: String(mes), anio: String(anio) });
  const data = await callJson(`/api/v1/academia/recibos/historial?${qs}`);
  return { eventos: data.eventos || [], recuperable: data.recuperable || null };
}

// Devuelve al recibo el estado (enviado/pagado) y las fechas que tenía el
// que se borró al rehacerlo. Solo lo que diga el historial.
export async function recuperarEstadoRecibo(id) {
  return callJson(`/api/v1/academia/recibos/${id}/recuperar-estado`, { method: "POST" });
}
