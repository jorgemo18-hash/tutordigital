import { fichar as ficharFn, fetchMiEstadoFichaje } from "../apiFichajes.js";
import { showToast } from "../toast.js";

// Widget persistente de fichar en el sidebar (junto a "Tema"/"Cerrar
// sesión") — visible en TODAS las secciones, no solo dentro de "Control
// horario": la acción de fichar no debe depender de navegar a ninguna
// pantalla concreta. Solo se monta si el tenant activó el control
// horario (ver academiaAdmin.js, mismo criterio que la sección del
// sidebar). Un solo botón hace de indicador de estado Y de acción — el
// punto de color siempre visible (incluso con el sidebar colapsado a
// 64px) muestra dentro/fuera, la etiqueta (solo visible al expandir)
// aclara qué pasará al pulsar.
export function buildFicharSidebarWidget({
  ficharFnDep = ficharFn,
  fetchMiEstadoFichajeFn = fetchMiEstadoFichaje,
} = {}) {
  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = "ac-sidebar-item";
  btn.disabled = true;

  const punto = document.createElement("span");
  punto.className = "ac-fichaje-punto ac-sidebar-icon";
  const label = document.createElement("span");
  btn.append(punto, label);

  let dentro = false;

  function pintar() {
    punto.className = `ac-fichaje-punto ac-sidebar-icon ${dentro ? "dentro" : "fuera"}`;
    label.textContent = dentro ? "Fichar salida" : "Fichar entrada";
  }

  async function cargarEstado() {
    try {
      const res = await fetchMiEstadoFichajeFn();
      dentro = Boolean(res.dentro);
      pintar();
      btn.disabled = false;
    } catch {
      label.textContent = "Fichar";
    }
  }

  btn.addEventListener("click", async () => {
    btn.disabled = true;
    try {
      await ficharFnDep(dentro ? "salida" : "entrada");
      dentro = !dentro;
      pintar();
      showToast(dentro ? "✓ Entrada fichada" : "✓ Salida fichada");
    } catch (err) {
      showToast(err.message || "No se pudo fichar.");
    }
    btn.disabled = false;
  });

  cargarEstado();
  return btn;
}
