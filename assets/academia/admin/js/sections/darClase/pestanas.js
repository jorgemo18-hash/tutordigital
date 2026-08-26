// Pestañas de la sección "Dar clase": Horario | Diario.
//
// Son las mismas dos del panel de profesor, pero NO se reutiliza su
// cabecera (`profesor/js/tabsHeader.js`): esa monta una cabecera de página
// entera — marca, nombre de usuario, botón de tema y cerrar sesión — que
// aquí duplicaría lo que ya da el menú lateral del admin. Lo único común
// de verdad son dos botones, y se pintan con `ac-list-tabs`, que ya existe
// en el panel de admin (ver alumnosList.js).
//
// El orden es el del panel de profesor: Horario primero, porque lo que se
// mira al llegar es "a quién me toca hoy", y el diario se rellena después.
export function buildPestanas(pestanas, { activaId, onSelect }) {
  const wrap = document.createElement("div");
  wrap.className = "ac-list-tabs";
  const botones = new Map();

  for (const pestana of pestanas) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "ac-list-tab";
    btn.textContent = pestana.label;
    btn.dataset.pestanaId = pestana.id;
    btn.addEventListener("click", () => onSelect(pestana.id));
    wrap.appendChild(btn);
    botones.set(pestana.id, btn);
  }

  function setActiva(id) {
    for (const [pestanaId, btn] of botones) btn.classList.toggle("active", pestanaId === id);
  }
  setActiva(activaId);

  return { wrap, setActiva };
}
