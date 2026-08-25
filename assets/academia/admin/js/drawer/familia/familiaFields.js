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

function buildRow(...campos) {
  const row = document.createElement("div");
  row.className = "ac-field-row";
  row.append(...campos.map((c) => c.wrap));
  return row;
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

// La familia agrupa alumnos bajo un mismo contacto y método de pago para
// facturación conjunta. "nombre" identifica a la familia como grupo (por
// eso el label dice "de la familia", no "del tutor"), pero es también lo
// que sale como titular en el recibo.
//
// DNI, teléfono, dirección, ciudad y código postal se añadieron después:
// existían desde el principio en academia_familias Y el PDF del recibo los
// imprime en el bloque "Datos del cliente" (ver reciboPdfPayload.js), pero
// no había ningún formulario en toda la aplicación para rellenarlos, así
// que ese bloque salía siempre vacío. Además llegan ya extraídos de la
// ficha de inscripción por OCR, así que en el alta normal no hay que
// teclearlos.
export function buildFamiliaFields(familia = {}) {
  const wrap = document.createElement("div");

  const nombre = buildField("Nombre de la familia", "input", { type: "text", value: familia.nombre || "" });
  const dni = buildField("DNI del titular", "input", { type: "text", value: familia.dni || "" });
  const email = buildField("Email", "input", { type: "email", value: familia.email || "" });
  const telefono = buildField("Teléfono", "input", { type: "text", value: familia.telefono || "" });
  const direccion = buildField("Dirección", "input", { type: "text", value: familia.direccion || "" });
  const ciudad = buildField("Ciudad", "input", { type: "text", value: familia.ciudad || "" });
  const codigoPostal = buildField("Código postal", "input", { type: "text", value: familia.codigo_postal || "" });
  const metodoPago = buildMetodoPagoSelect(familia.metodo_pago);
  const codigoSepa = buildField("IBAN", "input", { type: "text", value: familia.codigo_sepa || "" });

  function refreshSepaVisibility() {
    codigoSepa.wrap.classList.toggle("hidden", metodoPago.input.value !== "domiciliado");
  }
  metodoPago.input.addEventListener("change", refreshSepaVisibility);
  refreshSepaVisibility();

  wrap.append(
    nombre.wrap,
    buildRow(dni, telefono),
    email.wrap,
    direccion.wrap,
    buildRow(ciudad, codigoPostal),
    metodoPago.wrap,
    codigoSepa.wrap
  );

  const valorDe = (campo) => campo.input.value.trim() || null;

  return {
    wrap,
    getValue: () => ({
      nombre: nombre.input.value.trim(),
      dni: valorDe(dni),
      email: valorDe(email),
      telefono: valorDe(telefono),
      direccion: valorDe(direccion),
      ciudad: valorDe(ciudad),
      codigo_postal: valorDe(codigoPostal),
      metodo_pago: metodoPago.input.value || null,
      codigo_sepa: metodoPago.input.value === "domiciliado" ? valorDe(codigoSepa) : null,
    }),
  };
}
