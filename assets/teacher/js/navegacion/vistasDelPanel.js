// AGENDA · CUADERNO · RECURSOS, UNA VISTA CADA VEZ.
//
// Diseño de Claude Design (23/9): hasta ahora Agenda y Cuaderno iban
// apiladas en una sola página. Ahora hay una barra de primer nivel y se ve
// una sola; su contenido no cambia. Agenda es la vista por defecto.
//
// La vista elegida va en la dirección (#agenda, #cuaderno, #recursos): al
// recargar se vuelve a la misma, y "atrás" del navegador funciona.
export const VISTAS = ["agenda", "cuaderno", "recursos"];

export function vistaDeLaDireccion(hash) {
  const v = String(hash || "").replace(/^#/, "");
  return VISTAS.includes(v) ? v : "agenda";
}

// `raiz`: el panel ya pintado. `onCambio(vista)`: se avisa cada vez que se
// muestra una (Recursos se monta la primera vez que se abre).
export function montarVistasDelPanel({ raiz, win = globalThis.window, onCambio = () => {} }) {
  const botones = [...raiz.querySelectorAll("[data-vista]")];
  const secciones = [...raiz.querySelectorAll("[data-vista-de]")];
  let actual = null;

  function mostrar(vista, { apuntar = true } = {}) {
    if (!VISTAS.includes(vista) || vista === actual) return;
    actual = vista;
    for (const s of secciones) s.hidden = s.dataset.vistaDe !== vista;
    for (const b of botones) {
      const on = b.dataset.vista === vista;
      b.classList.toggle("is-on", on);
      if (on) b.setAttribute("aria-current", "page");
      else b.removeAttribute("aria-current");
    }
    if (apuntar) {
      try { win.history.replaceState(null, "", `#${vista}`); } catch { /* sin history: no pasa nada */ }
    }
    onCambio(vista);
  }

  for (const b of botones) b.addEventListener("click", () => mostrar(b.dataset.vista));
  win.addEventListener?.("hashchange", () => mostrar(vistaDeLaDireccion(win.location.hash), { apuntar: false }));
  mostrar(vistaDeLaDireccion(win.location?.hash), { apuntar: false });

  return { mostrar, get actual() { return actual; } };
}
