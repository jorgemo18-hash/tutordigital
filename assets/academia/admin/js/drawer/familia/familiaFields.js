import { motivoIbanInvalido, formatearIban, normalizarIban } from "../../../../../shared/js/iban.js";

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

  // El IBAN se comprueba MIENTRAS SE ESCRIBE, con su dígito de control.
  //
  // Era un texto libre: cualquier cosa se guardaba y el fallo aparecía
  // semanas después, cuando el banco devolvía el cargo. De los 22 que había
  // escritos a mano en Lyceo, cuatro no eran cobrables (tres con caracteres
  // de menos y uno con un dígito cambiado) y nada lo había dicho.
  //
  // El aviso va debajo del campo y no en un alert: corregir un IBAN es
  // mirar el papel y cambiar un carácter, y para eso hace falta seguir
  // viendo lo que hay escrito.
  const avisoIban = document.createElement("div");
  avisoIban.className = "ac-field-error";
  avisoIban.hidden = true;
  codigoSepa.wrap.appendChild(avisoIban);

  function revisarIban() {
    const motivo = motivoIbanInvalido(codigoSepa.input.value);
    avisoIban.textContent = motivo;
    avisoIban.hidden = !motivo;
    codigoSepa.input.classList.toggle("is-error", Boolean(motivo));
    return !motivo;
  }
  codigoSepa.input.addEventListener("input", revisarIban);
  // Al salir del campo se reescribe en grupos de cuatro, como en el papel
  // del banco: así se compara de un vistazo con lo que tienes delante.
  codigoSepa.input.addEventListener("blur", () => {
    const limpio = normalizarIban(codigoSepa.input.value);
    if (limpio) codigoSepa.input.value = formatearIban(limpio);
    revisarIban();
  });
  // Y de entrada, para que un IBAN mal guardado de antes se señale solo al
  // abrir la familia, sin esperar a que alguien toque el campo.
  if (codigoSepa.input.value) {
    codigoSepa.input.value = formatearIban(codigoSepa.input.value);
    revisarIban();
  }

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
    // Lo usa quien guarda para no mandar un IBAN que el backend va a
    // rechazar igualmente (los esquemas lo validan con la misma función):
    // así el error se enseña en el campo en vez de como un 400 genérico.
    ibanEsValido: () => metodoPago.input.value !== "domiciliado" || revisarIban(),
    getValue: () => ({
      nombre: nombre.input.value.trim(),
      dni: valorDe(dni),
      email: valorDe(email),
      telefono: valorDe(telefono),
      direccion: valorDe(direccion),
      ciudad: valorDe(ciudad),
      codigo_postal: valorDe(codigoPostal),
      metodo_pago: metodoPago.input.value || null,
      codigo_sepa: metodoPago.input.value === "domiciliado"
        ? (normalizarIban(codigoSepa.input.value) || null)
        : null,
    }),
  };
}
