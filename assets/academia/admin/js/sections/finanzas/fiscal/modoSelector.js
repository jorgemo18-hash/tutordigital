// Selector de modo "Trimestral" / "Anual" para la pestaña Fiscal.
// Mismo aspecto que .ac-list-tabs pero con solo dos botones — el contenedor
// padre (fiscalTab.js) decide qué renderizar cuando cambia el modo.
export function buildModoSelector(modoActivo, onCambio) {
  const wrap = document.createElement("div");
  wrap.className = "ac-list-tabs";
  wrap.style.marginBottom = "18px";

  const MODOS = [
    { id: "trimestral", label: "Trimestral" },
    { id: "anual",      label: "Anual" },
  ];
  const buttons = new Map();
  for (const { id, label } of MODOS) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "ac-list-tab";
    btn.textContent = label;
    btn.addEventListener("click", () => {
      for (const b of buttons.values()) b.classList.remove("active");
      btn.classList.add("active");
      onCambio(id);
    });
    wrap.appendChild(btn);
    buttons.set(id, btn);
  }
  buttons.get(modoActivo)?.classList.add("active");
  return wrap;
}
