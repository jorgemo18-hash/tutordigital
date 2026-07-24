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
export function createFicharBanner({
  ficharFnDep = ficharFn,
  fetchMiEstadoFichajeFn = fetchMiEstadoFichaje,
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
