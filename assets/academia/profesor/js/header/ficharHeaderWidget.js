import { fichar as ficharFn, fetchMiEstadoFichaje } from "../api.js";

// Acceso rápido de fichar en la cabecera (ac-h-actions, junto a
// "Claro"/"Cerrar sesión") — reemplaza a la antigua tab "Fichar" (ver
// tabsHeader.js): fichar entrada/salida es una acción puntual del día,
// no una sección de navegación en la que "entrar". Siempre disponible,
// en cualquier tab, sin tener que cambiar de pantalla. El punto+texto ya
// muestran el estado (dentro/fuera) como confirmación visual inmediata
// al pulsar, así que no hace falta un mensaje aparte aquí (a diferencia
// del banner superior, que desaparece del todo y sí necesita uno).
//
// Este widget y el banner superior son dos componentes independientes
// que pueden fichar la MISMA entrada/salida (el banner solo cubre
// entrada; la salida solo se puede fichar aquí) — sin wiring explícito
// entre ambos, fichar desde uno dejaba al otro con el estado obtenido al
// cargar la pantalla, ya obsoleto. `refrescar` se expone para que el
// composition root (academiaProfesor.js) pueda pedir a este widget que
// vuelva a comprobar el estado real tras un fichaje hecho en el banner,
// y `onFichado` para avisar al banner cuando el fichaje se hace aquí.
export function buildFicharHeaderWidget({
  ficharFnDep = ficharFn,
  fetchMiEstadoFichajeFn = fetchMiEstadoFichaje,
  onFichado = () => {},
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
      // Se vuelve a preguntar al servidor en vez de invertir `dentro` a
      // mano: es la única forma de que este widget y el banner superior
      // acaben siempre de acuerdo con el estado real, vengan de fichar
      // aquí o allí.
      await cargarEstado();
      onFichado();
    } catch (err) {
      const anterior = dentro ? "Dentro" : "Fuera";
      label.textContent = "Error";
      btn.title = err.message || "No se pudo fichar";
      setTimeout(() => { label.textContent = anterior; }, 2500);
    }
    btn.disabled = false;
  });

  cargarEstado();
  return { el: btn, refrescar: cargarEstado };
}
