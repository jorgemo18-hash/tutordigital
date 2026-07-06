// Toggle de modo de período (Mes/Trimestre, o Año/Trimestre/Mes) — mismo
// aspecto que fiscal/modoSelector.js pero parametrizable en número de
// opciones, para poder compartirlo entre Gastos (2 modos) y Resumen (3
// modos) sin acoplarlos entre sí ni con Fiscal.
export function buildModoPeriodoSelector(modos, modoActivo, onCambio) {
  const wrap = document.createElement("div");
  wrap.className = "ac-list-tabs";
  wrap.style.marginBottom = "12px";

  const buttons = new Map();
  for (const { id, label } of modos) {
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
