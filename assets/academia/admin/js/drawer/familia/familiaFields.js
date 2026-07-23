export const METODOS_PAGO = [
  { value: "bizum", label: "Bizum" },
  { value: "domiciliado", label: "Domiciliado · IBAN" },
  { value: "transferencia", label: "Transferencia" },
  { value: "efectivo", label: "Efectivo" },
];

export function metodoPagoLabel(value) {
  return METODOS_PAGO.find((m) => m.value === value)?.label || "—";
}

function buildField(label, tag, attrs = {}) {
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

function buildMetodoPagoSelect(value) {
  const field = buildField("Método de pago", "select");
  const blank = document.createElement("option");
  blank.value = "";
  blank.textContent = "Selecciona…";
  field.input.appendChild(blank);
  for (const m of METODOS_PAGO) {
    const opt = document.createElement("option");
    opt.value = m.value;
    opt.textContent = m.label;
    field.input.appendChild(opt);
  }
  field.input.value = value || "";
  return field;
}

// La familia agrupa alumnos bajo un mismo nombre de grupo familiar, email
// de contacto y método de pago para facturación conjunta — por eso solo
// lleva estos 4 campos (nada de dirección/DNI/notas, eso quedó fuera del
// nuevo modelo). "nombre" identifica a la familia como grupo, no a una
// persona concreta (por eso el label dice "de la familia", no "del tutor").
export function buildFamiliaFields(familia = {}) {
  const wrap = document.createElement("div");

  const nombre = buildField("Nombre de la familia", "input", { type: "text", value: familia.nombre || "" });
  const email = buildField("Email", "input", { type: "email", value: familia.email || "" });
  const metodoPago = buildMetodoPagoSelect(familia.metodo_pago);
  const codigoSepa = buildField("IBAN", "input", { type: "text", value: familia.codigo_sepa || "" });

  function refreshSepaVisibility() {
    codigoSepa.wrap.classList.toggle("hidden", metodoPago.input.value !== "domiciliado");
  }
  metodoPago.input.addEventListener("change", refreshSepaVisibility);
  refreshSepaVisibility();

  wrap.append(nombre.wrap, email.wrap, metodoPago.wrap, codigoSepa.wrap);

  return {
    wrap,
    getValue: () => ({
      nombre: nombre.input.value.trim(),
      email: email.input.value.trim() || null,
      metodo_pago: metodoPago.input.value || null,
      codigo_sepa: metodoPago.input.value === "domiciliado" ? codigoSepa.input.value.trim() || null : null,
    }),
  };
}
