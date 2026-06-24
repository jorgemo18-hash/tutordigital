const METODOS_PAGO = [
  { value: "bizum", label: "Bizum" },
  { value: "domiciliado", label: "Domiciliado · IBAN" },
  { value: "transferencia", label: "Transferencia" },
  { value: "efectivo", label: "Efectivo" },
];

function buildField(label, tag, attrs = {}) {
  const wrap = document.createElement("div");
  wrap.className = "ac-field";
  const span = document.createElement("label");
  span.className = "ac-field-label";
  span.textContent = label;
  wrap.appendChild(span);
  const input = document.createElement(tag);
  input.className = tag === "textarea" ? "ac-textarea" : tag === "select" ? "ac-select" : "ac-input";
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

// Bloque de campos editables de una familia (nuevo o "Editar" sobre una
// existente). Devuelve el wrap y un getValue() con la forma de
// FamiliaNuevaSchema del backend.
function buildFamiliaFields(familia = {}) {
  const wrap = document.createElement("div");

  const nombre = buildField("Nombre de la familia", "input", { type: "text", value: familia.nombre || "" });
  const email = buildField("Email", "input", { type: "email", value: familia.email || "" });
  const telefono = buildField("Teléfono", "input", { type: "text", value: familia.telefono || "" });
  const metodoPago = buildMetodoPagoSelect(familia.metodo_pago);
  const codigoSepa = buildField("IBAN / código SEPA", "input", { type: "text", value: familia.codigo_sepa || "" });
  const dni = buildField("DNI / NIF", "input", { type: "text", value: familia.dni || "" });
  const direccion = buildField("Dirección", "input", { type: "text", value: familia.direccion || "" });
  const ciudad = buildField("Ciudad", "input", { type: "text", value: familia.ciudad || "" });
  const codigoPostal = buildField("Código postal", "input", { type: "text", value: familia.codigo_postal || "" });
  const notas = buildField("Notas", "textarea", { rows: 2, value: familia.notas || "" });

  function refreshSepaVisibility() {
    codigoSepa.wrap.classList.toggle("hidden", metodoPago.input.value !== "domiciliado");
  }
  metodoPago.input.addEventListener("change", refreshSepaVisibility);
  refreshSepaVisibility();

  wrap.append(
    nombre.wrap, email.wrap, telefono.wrap, metodoPago.wrap, codigoSepa.wrap,
    dni.wrap, direccion.wrap, ciudad.wrap, codigoPostal.wrap, notas.wrap
  );

  return {
    wrap,
    getValue: () => ({
      nombre: nombre.input.value.trim(),
      email: email.input.value.trim() || null,
      telefono: telefono.input.value.trim() || null,
      metodo_pago: metodoPago.input.value || null,
      codigo_sepa: metodoPago.input.value === "domiciliado" ? codigoSepa.input.value.trim() || null : null,
      dni: dni.input.value.trim() || null,
      direccion: direccion.input.value.trim() || null,
      ciudad: ciudad.input.value.trim() || null,
      codigo_postal: codigoPostal.input.value.trim() || null,
      notas: notas.input.value.trim() || null,
    }),
  };
}

function buildExistenteCard(familia, onEditar) {
  const card = document.createElement("div");
  card.className = "ac-familia-existente";
  const row = document.createElement("div");
  row.className = "ac-familia-existente-row";

  const info = document.createElement("div");
  const name = document.createElement("div");
  name.className = "ac-familia-existente-name";
  name.textContent = familia.nombre || "(sin nombre)";
  const mail = document.createElement("div");
  mail.className = "ac-familia-existente-mail";
  mail.textContent = familia.email || "Sin email";
  info.append(name, mail);

  const editarBtn = document.createElement("button");
  editarBtn.type = "button";
  editarBtn.className = "ac-btn ghost";
  editarBtn.textContent = "Editar";
  editarBtn.addEventListener("click", onEditar);

  row.append(info, editarBtn);
  card.appendChild(row);
  return card;
}

// `familias`: [{id,nombre,email}] para el selector. `familiaActual`: familia
// completa ya vinculada al alumno (null si no tiene, o si es un alumno nuevo).
export function buildFamiliaSection({ familias = [], familiaActual = null } = {}) {
  const wrap = document.createElement("div");

  const head = document.createElement("div");
  head.className = "ac-section-head";
  const title = document.createElement("span");
  title.className = "ac-section-title";
  title.textContent = "FAMILIA";
  const toggleLabel = document.createElement("label");
  toggleLabel.className = "ac-toggle";
  const toggleInput = document.createElement("input");
  toggleInput.type = "checkbox";
  toggleInput.checked = !familiaActual;
  toggleLabel.append(toggleInput, document.createTextNode("Sin familia"));
  head.append(title, toggleLabel);
  wrap.appendChild(head);

  const body = document.createElement("div");
  wrap.appendChild(body);

  const selectorField = buildField("Familia existente", "select");
  const blank = document.createElement("option");
  blank.value = "";
  blank.textContent = "— Ninguna (crear nueva) —";
  selectorField.input.appendChild(blank);
  for (const f of familias) {
    const opt = document.createElement("option");
    opt.value = f.id;
    opt.textContent = f.email ? `${f.nombre} (${f.email})` : f.nombre;
    selectorField.input.appendChild(opt);
  }
  selectorField.input.value = familiaActual?.id || "";

  let editando = !familiaActual;
  let prefillDatos = null;
  const fieldsContainer = document.createElement("div");
  let fields = null;

  function familiaSeleccionada() {
    const id = selectorField.input.value;
    if (!id) return null;
    if (familiaActual?.id === id) return familiaActual;
    return familias.find((f) => f.id === id) || null;
  }

  function renderFieldsArea() {
    fieldsContainer.innerHTML = "";
    const seleccionada = familiaSeleccionada();
    if (seleccionada && !editando) {
      fieldsContainer.appendChild(buildExistenteCard(seleccionada, () => { editando = true; renderFieldsArea(); }));
      fields = null;
      return;
    }
    fields = buildFamiliaFields(seleccionada || prefillDatos || {});
    fieldsContainer.appendChild(fields.wrap);
  }

  selectorField.input.addEventListener("change", () => {
    editando = !familiaSeleccionada();
    renderFieldsArea();
  });

  function renderBody() {
    body.innerHTML = "";
    body.classList.toggle("hidden", toggleInput.checked);
    if (toggleInput.checked) return;
    body.append(selectorField.wrap, fieldsContainer);
    renderFieldsArea();
  }
  toggleInput.addEventListener("change", renderBody);
  renderBody();

  return {
    wrap,
    getValue: () => {
      if (toggleInput.checked) return { familia_id: null };
      const seleccionada = familiaSeleccionada();
      if (seleccionada && !editando) return { familia_id: seleccionada.id };
      if (seleccionada && editando) return { familia_id: seleccionada.id, familia_actualizada: fields.getValue() };
      return { familia_nueva: fields.getValue() };
    },
    // Rellena el bloque "familia nueva" con datos extraídos por OCR.
    // Desmarca "Sin familia" y deselecciona cualquier familia existente.
    prefillNueva(datos = {}) {
      prefillDatos = datos;
      toggleInput.checked = false;
      selectorField.input.value = "";
      editando = true;
      renderBody();
    },
  };
}
