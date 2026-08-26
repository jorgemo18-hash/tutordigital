// Aparte de api.js a propósito — mismo criterio que apiSustituciones.js/
// apiFichajes.js: funcionalidad nueva y autocontenida.
import { callJson } from "./apiCore.js";

export async function fetchListaEspera() {
  const data = await callJson("/api/v1/academia/lista-espera");
  return data.entradas || [];
}

export async function crearEntradaListaEspera({ nombre, curso, telefono, email, notas }) {
  return callJson("/api/v1/academia/lista-espera", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ nombre, curso, telefono, email, notas }),
  });
}

// PATCH parcial: `cambios` lleva solo los campos tocados. Mandar el objeto
// entero borraría en el servidor lo que la fila tuviera y el formulario no
// mostrase.
export async function actualizarEntradaListaEspera(id, cambios) {
  const data = await callJson(`/api/v1/academia/lista-espera/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(cambios),
  });
  return data.entrada;
}

export async function eliminarEntradaListaEspera(id) {
  return callJson(`/api/v1/academia/lista-espera/${id}`, { method: "DELETE" });
}
