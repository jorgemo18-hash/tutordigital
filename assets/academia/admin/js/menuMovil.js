// EL MENÚ DEL PANEL EN EL MÓVIL.
//
// En el ordenador el menú es una columna de 64 px a la izquierda que se
// abre al pasar el ratón. En un móvil no hay ratón, y esa columna se comía
// 64 de 390 px en todas las pantallas (auditoría del 24/09/2026: la lista
// de alumnos no enseñaba ni el nombre). Por debajo de 720 px el menú se
// esconde a la izquierda y lo abre un botón arriba; se cierra al elegir una
// sección, al pinchar fuera o con Escape. Todo lo demás lo hace el CSS
// (_academia-admin-movil.css): en el ordenador el botón no se ve.
export const CLASE_ABIERTO = "ac-menu-abierto";

export function montarMenuMovil({ app, nav, doc = document }) {
  const boton = doc.createElement("button");
  boton.type = "button";
  boton.className = "ac-menu-btn";
  boton.setAttribute("aria-label", "Abrir el menú");
  boton.setAttribute("aria-expanded", "false");
  for (let i = 0; i < 3; i += 1) boton.appendChild(doc.createElement("span"));
  const velo = doc.createElement("div");
  velo.className = "ac-menu-velo";

  function ponerAbierto(abierto) {
    app.classList.toggle(CLASE_ABIERTO, abierto);
    boton.setAttribute("aria-expanded", String(abierto));
    boton.setAttribute("aria-label", abierto ? "Cerrar el menú" : "Abrir el menú");
  }
  const cerrar = () => ponerAbierto(false);

  boton.addEventListener("click", () => ponerAbierto(!app.classList.contains(CLASE_ABIERTO)));
  velo.addEventListener("click", cerrar);
  nav.addEventListener("click", (e) => { if (e.target.closest?.(".ac-sidebar-item")) cerrar(); });
  doc.addEventListener("keydown", (e) => { if (e.key === "Escape") cerrar(); });

  app.append(boton, velo);
  return { cerrar, abrir: () => ponerAbierto(true) };
}
