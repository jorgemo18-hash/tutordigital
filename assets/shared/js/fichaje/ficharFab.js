import { calcularEstadoFichajeFab } from "./ficharFabEstado.js";

// FAB (floating action button) de fichaje — reemplaza al banner
// horizontal superior y al widget de cabecera que existían antes (ver
// commits previos de academiaProfesor.js/academiaAdmin.js): un único
// componente persistente, fijo en la esquina inferior derecha, igual en
// móvil estrecho que en escritorio, visible en cualquier pantalla de
// cualquiera de los dos paneles. Se monta en document.body (fuera del
// árbol de cada panel) para que su position:fixed nunca dependa de un
// ancestro concreto — mismo criterio que .ac-toast en el panel admin.
//
// Compartido entre admin y profesor: cada panel tiene su propio
// api.js/apiFichajes.js, así que ficharFnDep/fetchMiEstadoFichajeFn son
// dependencias explícitas obligatorias, nunca importadas aquí.
//
// Al ser un único componente (ya no dos independientes) no hace falta
// ningún wiring de sincronización entre componentes — tras cualquier
// fichaje propio simplemente se vuelve a preguntar el estado real.
export function createFicharFab({
  ficharFnDep,
  fetchMiEstadoFichajeFn,
  horasAvisoSalida,
  intervaloRefrescoMs = 5 * 60 * 1000,
} = {}) {
  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = "ac-fichar-fab hidden";
  btn.disabled = true;

  const punto = document.createElement("span");
  punto.className = "ac-fichaje-punto";
  const label = document.createElement("span");
  label.className = "ac-fichar-fab-label";
  btn.append(punto, label);

  let siguienteTipo = "entrada";

  function pintar(estado) {
    btn.classList.toggle("pendiente", estado.pendiente);
    btn.classList.toggle("regla", !estado.pendiente);
    punto.className = `ac-fichaje-punto ${estado.dentro ? "dentro" : "fuera"}`;
    // Compacto ("en regla"): sin texto. Prominente ("pendiente"): con
    // etiqueta corta. El title/aria-label describe la acción siempre,
    // visible o no el texto.
    label.textContent = estado.pendiente ? estado.etiquetaAccion : "";
    btn.title = estado.etiquetaAccion;
    btn.setAttribute("aria-label", estado.etiquetaAccion);
    siguienteTipo = estado.siguienteTipo;
  }

  async function cargarEstado() {
    try {
      const res = await fetchMiEstadoFichajeFn();
      pintar(calcularEstadoFichajeFab(res, { horasAvisoSalida }));
      btn.classList.remove("hidden");
      btn.disabled = false;
    } catch {
      // Fail-safe: si no se puede comprobar el estado, mejor no mostrar
      // nada que mostrar un FAB con un estado potencialmente erróneo.
      btn.classList.add("hidden");
      btn.disabled = true;
    }
  }

  btn.addEventListener("click", async () => {
    btn.disabled = true;
    try {
      await ficharFnDep(siguienteTipo);
      await cargarEstado();
    } catch (err) {
      label.textContent = "Error";
      btn.title = err.message || "No se pudo fichar";
      setTimeout(cargarEstado, 2500);
    }
    btn.disabled = false;
  });

  cargarEstado();

  // Recalcula periódicamente aunque no haya clics: es la única forma de
  // que el aviso de "8h dentro" (ver ficharFabEstado.js) aparezca solo
  // con el paso del tiempo. `unref` evita que este timer mantenga vivo
  // el proceso en Node (tests) — no existe en el navegador, de ahí el
  // chequeo.
  const intervalo = setInterval(cargarEstado, intervaloRefrescoMs);
  if (typeof intervalo.unref === "function") intervalo.unref();

  return { el: btn, refrescar: cargarEstado, detener: () => clearInterval(intervalo) };
}
