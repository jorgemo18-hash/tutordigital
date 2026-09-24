// En el móvil (≤ 720 px, el mismo corte que _academia-admin-movil.css) las
// pantallas de lista + panel se apilan: el panel queda debajo de la lista.
// Al elegir algo en la lista, se baja hasta el panel. En el ordenador el
// panel ya está a la vista y no se mueve nada.
export const CORTE_MOVIL = "(max-width: 720px)";

export function llevarAlPanelEnMovil(el, win = globalThis.window) {
  if (!el || !win?.matchMedia?.(CORTE_MOVIL).matches) return false;
  el.scrollIntoView?.({ behavior: "smooth", block: "start" });
  return true;
}
