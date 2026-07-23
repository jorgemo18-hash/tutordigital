import { fichar as ficharFn, fetchMiEstadoFichaje } from "../api.js";

// Widget persistente de fichar en la cabecera (ac-h-actions, junto a
// "Claro"/"Cerrar sesión") — visible en TODAS las tabs, no solo dentro de
// "Fichar": la acción de fichar no debe depender de navegar a ninguna
// pantalla concreta. Solo se monta si el tenant activó el control
// horario (ver academiaProfesor.js, mismo criterio que la tab). Un solo
// elemento hace de indicador de estado Y de botón — el punto+texto
// muestran "Dentro"/"Fuera", el título explica qué hace el clic, sin
// necesitar dos controles separados en un espacio tan reducido.
export function buildFicharHeaderWidget({
  ficharFnDep = ficharFn,
  fetchMiEstadoFichajeFn = fetchMiEstadoFichaje,
} = {}) {
  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = "ac-pill ac-fichar-pill";
  btn.disabled = true;

  const punto = document.createElement("span");
  punto.className = "ac-fichaje-punto";
  const label = document.createElement("span");
  btn.append(punto, label);

  let dentro = false;

  function pintar() {
    btn.classList.toggle("dentro", dentro);
    btn.classList.toggle("fuera", !dentro);
    punto.className = `ac-fichaje-punto ${dentro ? "dentro" : "fuera"}`;
    label.textContent = dentro ? "Dentro" : "Fuera";
    btn.title = dentro ? "Fichar salida" : "Fichar entrada";
  }

  async function cargarEstado() {
    try {
      const res = await fetchMiEstadoFichajeFn();
      dentro = Boolean(res.dentro);
      pintar();
      btn.disabled = false;
    } catch {
      label.textContent = "Fichar";
      btn.title = "No se pudo comprobar tu estado";
    }
  }

  btn.addEventListener("click", async () => {
    btn.disabled = true;
    try {
      await ficharFnDep(dentro ? "salida" : "entrada");
      dentro = !dentro;
      pintar();
    } catch (err) {
      const anterior = dentro ? "Dentro" : "Fuera";
      label.textContent = "Error";
      btn.title = err.message || "No se pudo fichar";
      setTimeout(() => { label.textContent = anterior; }, 2500);
    }
    btn.disabled = false;
  });

  cargarEstado();
  return btn;
}
