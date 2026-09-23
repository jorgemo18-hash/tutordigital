// PIEZAS DE PANTALLA DE RECURSOS: botón, etiqueta, campo, puntos de
// dificultad. Con las clases del diseño de Claude Design (prefijo rc-, ver
// styles/teacher-new/10-recursos.css) para no chocar con las del panel.

export function el(doc, etiqueta, clase = "", texto = null) {
  const n = doc.createElement(etiqueta);
  if (clase) n.className = clase;
  if (texto != null) n.textContent = texto;
  return n;
}

export function boton(doc, texto, { clase = "", onClick = null, titulo = "" } = {}) {
  const b = el(doc, "button", `rc-btn ${clase}`.trim(), texto);
  b.type = "button";
  if (titulo) b.title = titulo;
  if (onClick) b.addEventListener("click", onClick);
  return b;
}

export function etiqueta(doc, texto, clase = "") {
  return el(doc, "span", `rc-tag ${clase}`.trim(), texto);
}

// "Materia", "Curso"… en mayúsculas pequeñas encima del control.
export function campo(doc, texto, control, clase = "") {
  const wrap = el(doc, "label", `rc-fld ${clase}`.trim());
  wrap.append(el(doc, "span", "rc-fld__lbl", texto), control);
  return wrap;
}

export function selector(doc, opciones, valor) {
  const s = el(doc, "select", "rc-sel");
  for (const [v, t] of opciones) {
    const op = el(doc, "option", "", t);
    op.value = String(v);
    s.appendChild(op);
  }
  if (valor != null) s.value = String(valor);
  return s;
}

// Tres puntos, tantos llenos como la dificultad (1-3).
export function dificultad(doc, nivel, { corto = false } = {}) {
  const wrap = el(doc, "span", "rc-dif");
  const puntos = el(doc, "s");
  for (let i = 1; i <= 3; i += 1) puntos.appendChild(el(doc, "i", i <= nivel ? "on" : ""));
  wrap.append(puntos, doc.createTextNode(corto ? `Dif. ${nivel}` : `Dificultad ${nivel}`));
  wrap.setAttribute("aria-label", `Dificultad ${nivel} de 3`);
  return wrap;
}
