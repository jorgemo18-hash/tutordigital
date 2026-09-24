import { el } from "./elementos.js";

// RECURSOS TIENE TRES COSAS: Hojas de ejercicios, Currículo y Programación.
// El diseño decía que una pestaña con una sola entrada era ruido; con
// varias, ya hace falta elegir. Cada una se monta la primera vez que se abre.
//
// Lo usan el panel de escritorio (montarRecursos.js) y el móvil
// (mobile/mobileTeacherRecursos.js). `crear.hojas()`, `crear.curriculo()` y `crear.programacion()`
// devuelven pantallas con `render(raiz)`.
export const PESTANAS = [
  ["hojas", "Hojas de ejercicios"],
  ["curriculo", "Currículo"],
  ["programacion", "Programación"],
];

export function montarRecursosConPestanas({ raiz, crear, doc = document }) {
  const nav = el(doc, "div", "rc-subnav");
  nav.setAttribute("role", "tablist");
  const vistas = {};
  const pantallas = {};
  const botones = {};
  for (const [clave, texto] of PESTANAS) {
    const b = el(doc, "button", "rc-subnav__btn", texto);
    b.type = "button";
    b.setAttribute("role", "tab");
    b.addEventListener("click", () => mostrar(clave));
    botones[clave] = b;
    nav.appendChild(b);
    vistas[clave] = el(doc, "div", "rc-subvista");
    vistas[clave].dataset.sub = clave;
  }
  raiz.replaceChildren(nav, ...Object.values(vistas));

  function mostrar(clave) {
    for (const [k] of PESTANAS) {
      vistas[k].hidden = k !== clave;
      botones[k].classList.toggle("is-on", k === clave);
      botones[k].setAttribute("aria-selected", String(k === clave));
    }
    if (!pantallas[clave]) {
      pantallas[clave] = crear[clave]();
      pantallas[clave].render(vistas[clave]);
    }
  }

  mostrar("hojas");
  return {
    mostrar,
    revisarAsignatura: () => pantallas.hojas?.revisarAsignatura?.(),
    get pantallas() { return pantallas; },
  };
}
