// Campo label+input genérico (.ac-field) compartido por los formularios de
// Finanzas — gastoFormFields.js (drawer de gasto) y las sub-pestañas de
// fiscal/ (Modelo 130/115/111) construyen sus campos editables con esto.
export function buildField(label, tag, attrs = {}) {
  const wrap = document.createElement("div");
  wrap.className = "ac-field";
  const span = document.createElement("label");
  span.className = "ac-field-label";
  span.textContent = label;
  wrap.appendChild(span);
  const input = document.createElement(tag);
  input.className = tag === "select" ? "ac-select" : "ac-input";
  Object.entries(attrs).forEach(([key, value]) => { input[key] = value; });
  wrap.appendChild(input);
  return { wrap, input };
}
