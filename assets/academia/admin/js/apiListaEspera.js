// Aparte de api.js a propósito — mismo criterio que apiSustituciones.js/
// apiFichajes.js: funcionalidad nueva y autocontenida.
import { callJson } from "./apiCore.js";

export async function fetchListaEspera() {
  const data = await callJson("/api/v1/academia/lista-espera");
  return data.entradas || [];
}

export async function crearEntradaListaEspera({ nombre, curso, telefono, notas }) {
  return callJson("/api/v1/academia/lista-espera", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ nombre, curso, telefono, notas }),
  });
}

export async function eliminarEntradaListaEspera(id) {
  return callJson(`/api/v1/academia/lista-espera/${id}`, { method: "DELETE" });
}
