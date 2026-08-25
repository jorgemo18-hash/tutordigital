// Interruptor de Ajustes: <label class="ac-toggle"> con checkbox + texto.
//
// Estaba copiado literalmente en personalTab.js, facturacionTab.js y
// inscripcion/camposPanel.js — tres definiciones idénticas que había que
// mantener a la vez. Se unifica aquí al añadir el cuarto uso (el
// interruptor de acceso al tutor en centroTab.js).
export function buildToggle(label, checked) {
  const wrap = document.createElement("label");
  wrap.className = "ac-toggle";
  const input = document.createElement("input");
  input.type = "checkbox";
  input.checked = checked;
  const span = document.createElement("span");
  span.textContent = label;
  wrap.append(input, span);
  return { wrap, input };
}
