import { fichar as ficharFn, fetchMiEstadoFichaje } from "../api.js";

// Banner superior persistente — ocupa su propia fila del grid de
// .ac-shell (ver .ac-shell.con-fichar-banner en academiaProfesor.js), no
// vive dentro de .ac-body, así que ningún cambio de tab lo toca. Solo se
// muestra si el tenant activó el control horario Y el trabajador todavía
// no ha fichado ENTRADA hoy (no "está fuera": alguien que ya fichó
// entrada+salida hoy está fuera pero SÍ fichó, el banner no debe
// reaparecerle). Desaparece en cuanto ficha, vuelve a aparecer al día
// siguiente si no ha fichado. Nunca bloquea: no es modal, se puede
// seguir navegando con el banner visible.
function esperar(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// `confirmacionMs`: cuánto se deja ver "✓ Fichado correctamente" antes de
// ocultar el banner — sin esto, el banner simplemente desaparecía en
// cuanto se pulsaba el botón, sin ningún mensaje, y se sentía como un
// fallo silencioso aunque el fichaje sí se hubiera guardado. Parámetro
// explícito (no una constante) para que los tests puedan acortarlo.
//
// `onFichado`: avisa al composition root (academiaProfesor.js) de que
// este banner acaba de fichar entrada, para que pueda refrescar el
// widget de la cabecera (ver ficharHeaderWidget.js) — sin esto, el
// widget se quedaba con el estado "Fuera" obtenido al cargar la
// pantalla, aunque el banner sí hubiera fichado la entrada.
export function createFicharBanner({
  ficharFnDep = ficharFn,
  fetchMiEstadoFichajeFn = fetchMiEstadoFichaje,
  confirmacionMs = 1200,
  onFichado = () => {},
} = {}) {
  const el = document.createElement("div");
  el.className = "ac-fichar-banner hidden";

  const texto = document.createElement("span");
  texto.className = "ac-fichar-banner-texto";
  texto.textContent = "Aún no has fichado hoy.";

  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = "ac-btn primary";
  btn.textContent = "Fichar entrada";

  const msg = document.createElement("span");
  msg.className = "ac-drawer-msg";

  el.append(texto, btn, msg);

  async function refresh() {
    try {
      const res = await fetchMiEstadoFichajeFn();
      el.classList.toggle("hidden", Boolean(res.haFichadoEntradaHoy));
    } catch {
      el.classList.add("hidden");
    }
  }

  btn.addEventListener("click", async () => {
    btn.disabled = true;
    msg.textContent = "";
    try {
      await ficharFnDep("entrada");
      onFichado();
      msg.textContent = "✓ Fichado correctamente";
      msg.className = "ac-drawer-msg ok";
      await esperar(confirmacionMs);
      el.classList.add("hidden");
    } catch (err) {
      msg.textContent = err.message || "No se pudo fichar.";
      msg.className = "ac-drawer-msg error";
    }
    btn.disabled = false;
  });

  refresh();
  return { el, refresh };
}
