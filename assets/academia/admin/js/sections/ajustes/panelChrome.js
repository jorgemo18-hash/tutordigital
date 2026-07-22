// Cabecera (título + descripción) y pie (hint + acciones) compartidos por
// todos los paneles de Ajustes — evita repetir esta misma estructura en
// cada tab.
export function buildPanelHead(title, desc) {
  const head = document.createElement("div");
  head.className = "ac-panel-head";
  const left = document.createElement("div");
  const t = document.createElement("div");
  t.className = "ac-panel-title";
  t.textContent = title;
  left.appendChild(t);
  if (desc) {
    const d = document.createElement("div");
    d.className = "ac-panel-desc";
    d.textContent = desc;
    left.appendChild(d);
  }
  head.appendChild(left);
  return head;
}

export function buildPanelFoot(hintText = "") {
  const foot = document.createElement("div");
  foot.className = "ac-panel-foot";
  const hint = document.createElement("span");
  hint.className = "ac-foot-hint";
  hint.textContent = hintText;
  foot.appendChild(hint);
  return { foot, hint };
}

// Chip insertable de variable de plantilla ({mes}, {año}, {total}...) —
// compartido por todos los paneles de Ajustes que ofrecen variables de
// sustitución (facturacionTab.js, emailTextos/emailTextoPanelBase.js), para
// no repetir el mismo botón en cada uno.
export function buildVarchip(texto, onClick) {
  const chip = document.createElement("button");
  chip.type = "button";
  chip.className = "ac-varchip";
  chip.textContent = texto;
  chip.addEventListener("click", () => onClick(texto));
  return chip;
}
