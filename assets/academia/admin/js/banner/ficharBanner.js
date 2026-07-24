import { fichar as ficharFn, fetchMiEstadoFichaje } from "../apiFichajes.js";

// Banner superior persistente — se monta como hermano de .ac-main-shell
// (ver academiaAdmin.js), así que ningún render de sección lo toca:
// permanece igual en todas ellas. Solo se muestra si el tenant activó el
// control horario Y el trabajador todavía no ha fichado ENTRADA hoy (no
// "está fuera": alguien que ya fichó entrada+salida hoy está fuera pero
// SÍ fichó, el banner no debe reaparecerle). Desaparece en cuanto ficha,
// vuelve a aparecer al día siguiente si no ha fichado. Nunca bloquea:
// no es modal, se puede seguir navegando con el banner visible.
function esperar(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// `confirmacionMs`: cuánto se deja ver "✓ Fichado correctamente" antes de
// ocultar el banner — sin esto, el banner simplemente desaparecía en
// cuanto se pulsaba el botón, sin ningún mensaje, y se sentía como un
// fallo silencioso aunque el fichaje sí se hubiera guardado. Parámetro
// explícito (no una constante) para que los tests puedan acortarlo.
export function createFicharBanner({
  ficharFnDep = ficharFn,
  fetchMiEstadoFichajeFn = fetchMiEstadoFichaje,
  confirmacionMs = 1200,
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
      // Si no se puede comprobar el estado, no se muestra el banner —
      // más seguro no molestar que mostrar un aviso que podría ser falso.
      el.classList.add("hidden");
    }
  }

  btn.addEventListener("click", async () => {
    btn.disabled = true;
    msg.textContent = "";
    try {
      await ficharFnDep("entrada");
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
