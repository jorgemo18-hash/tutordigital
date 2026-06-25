import { fetchFamilias } from "../api.js";

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

// Campos editables de una familia. El teléfono del alumno vive en "Datos
// del alumno" (corrección 4) — el resto de contacto (dirección/ciudad/CP)
// sigue siendo propio de la familia como pagador.
function buildFamiliaFields(familia = {}) {
  const wrap = document.createElement("div");

  const nombre = buildField("Nombre de la familia", "input", { type: "text", value: familia.nombre || "" });
  const email = buildField("Email", "input", { type: "email", value: familia.email || "" });
  const metodoPago = buildMetodoPagoSelect(familia.metodo_pago);
  const codigoSepa = buildField("IBAN", "input", { type: "text", value: familia.codigo_sepa || "" });
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
    nombre.wrap, email.wrap, metodoPago.wrap, codigoSepa.wrap, dni.wrap,
    direccion.wrap, ciudad.wrap, codigoPostal.wrap, notas.wrap
  );

  return {
    wrap,
    getValue: () => ({
      nombre: nombre.input.value.trim(),
      email: email.input.value.trim() || null,
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

function metodoPagoLabel(value) {
  return METODOS_PAGO.find((m) => m.value === value)?.label || "—";
}

function buildDatoRow(label, valor) {
  const labelEl = document.createElement("span");
  labelEl.className = "ac-field-label";
  labelEl.textContent = label;
  const valorEl = document.createElement("span");
  valorEl.textContent = valor || "—";
  return [labelEl, valorEl];
}

function buildExistenteCard(familia) {
  const card = document.createElement("div");
  card.className = "ac-familia-existente";
  const name = document.createElement("div");
  name.className = "ac-familia-existente-name";
  name.textContent = familia?.nombre || "(sin nombre)";
  card.appendChild(name);

  const grid = document.createElement("div");
  grid.className = "ac-familia-existente-grid";
  grid.append(
    ...buildDatoRow("Email", familia?.email),
    ...buildDatoRow("Método de pago", metodoPagoLabel(familia?.metodo_pago)),
    ...buildDatoRow("DNI / NIF", familia?.dni),
    ...buildDatoRow("Dirección", familia?.direccion),
    ...buildDatoRow("Ciudad", familia?.ciudad),
    ...buildDatoRow("Código postal", familia?.codigo_postal),
    ...buildDatoRow("Notas", familia?.notas)
  );
  card.appendChild(grid);
  return card;
}

function buildSelectorFamilias(familias) {
  const field = buildField("Familia", "select");
  const nueva = document.createElement("option");
  nueva.value = "";
  nueva.textContent = "— Crear familia nueva —";
  field.input.appendChild(nueva);
  for (const f of familias) {
    const opt = document.createElement("option");
    opt.value = f.id;
    opt.textContent = f.email ? `${f.nombre} (${f.email})` : f.nombre;
    field.input.appendChild(opt);
  }
  return field;
}

function buildActionsRow(buttons) {
  const row = document.createElement("div");
  row.style.display = "flex";
  row.style.gap = "8px";
  row.style.marginTop = "10px";
  row.append(...buttons);
  return row;
}

function buildBtn(texto, claseExtra, onClick) {
  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = `ac-btn ${claseExtra}`;
  btn.textContent = texto;
  btn.addEventListener("click", onClick);
  return btn;
}

// `familiaActual`: familia completa ya vinculada al alumno al abrir el
// drawer (null si es alumno nuevo o no tiene familia). El listado de
// familias para el selector se carga a demanda (fetchFamiliasFn) cuando
// el admin pulsa "+ Vincular a familia", no de entrada. `onFamiliaCambio`
// se llama al elegir algo en el selector: con la familia elegida (existente)
// o con `null` (Crear familia nueva) — para que "Datos del alumno" pueda
// prerellenar/vaciar su contacto a juego.
export function buildFamiliaSection({ familiaActual = null, fetchFamiliasFn = fetchFamilias, onFamiliaCambio } = {}) {
  const wrap = document.createElement("div");
  const title = document.createElement("div");
  title.className = "ac-section-title";
  title.textContent = "FAMILIA";
  wrap.appendChild(title);
  const spacer = document.createElement("div");
  spacer.style.height = "10px";
  wrap.appendChild(spacer);

  const body = document.createElement("div");
  wrap.appendChild(body);

  // Estados: "vacio" | "cargando" | "selector" | "nueva" |
  //          "existente_picked" | "existente_editar" |
  //          "vinculada" | "vinculada_editar"
  let modo = familiaActual ? "vinculada" : "vacio";
  let listaFamilias = [];
  let familiaElegidaId = familiaActual?.id || null;
  let prefillNuevaDatos = null;
  let fields = null;

  function familiaElegida() {
    if (modo.startsWith("vinculada")) return familiaActual;
    if (familiaElegidaId) return listaFamilias.find((f) => f.id === familiaElegidaId) || null;
    return null;
  }

  function render() {
    body.innerHTML = "";
    fields = null;

    if (modo === "vacio") {
      body.appendChild(
        buildBtn("+ Vincular a familia", "ghost", async () => {
          modo = "cargando";
          render();
          try {
            listaFamilias = await fetchFamiliasFn();
            modo = "selector";
          } catch {
            modo = "nueva"; // si falla la carga, al menos se puede crear una nueva
          }
          render();
        })
      );
      return;
    }

    if (modo === "cargando") {
      const p = document.createElement("p");
      p.className = "ac-loading";
      p.textContent = "Cargando familias…";
      body.appendChild(p);
      return;
    }

    if (modo === "selector") {
      const selector = buildSelectorFamilias(listaFamilias);
      selector.input.addEventListener("change", () => {
        const id = selector.input.value;
        if (!id) {
          modo = "nueva";
          onFamiliaCambio?.(null);
        } else {
          familiaElegidaId = id;
          modo = "existente_picked";
          onFamiliaCambio?.(listaFamilias.find((f) => f.id === id) || null);
        }
        render();
      });
      body.appendChild(selector.wrap);
      return;
    }

    if (modo === "nueva") {
      fields = buildFamiliaFields(prefillNuevaDatos || {});
      body.appendChild(fields.wrap);
      return;
    }

    if (modo === "existente_picked") {
      body.appendChild(buildExistenteCard(familiaElegida()));
      body.appendChild(
        buildActionsRow([
          buildBtn("Editar datos de familia", "ghost", () => { modo = "existente_editar"; render(); }),
        ])
      );
      return;
    }

    if (modo === "existente_editar") {
      fields = buildFamiliaFields(familiaElegida() || {});
      body.appendChild(fields.wrap);
      return;
    }

    if (modo === "vinculada") {
      body.appendChild(buildExistenteCard(familiaActual));
      body.appendChild(
        buildActionsRow([
          buildBtn("Editar", "ghost", () => { modo = "vinculada_editar"; render(); }),
          buildBtn("Desvincular familia", "ghost", () => { modo = "vacio"; familiaElegidaId = null; render(); }),
        ])
      );
      return;
    }

    if (modo === "vinculada_editar") {
      fields = buildFamiliaFields(familiaActual || {});
      body.appendChild(fields.wrap);
    }
  }
  render();

  return {
    wrap,
    getValue: () => {
      if (modo === "vacio" || modo === "cargando" || modo === "selector") return { familia_id: null };
      if (modo === "nueva") return { familia_nueva: fields.getValue() };
      if (modo === "existente_picked") return { familia_id: familiaElegidaId };
      if (modo === "existente_editar") return { familia_id: familiaElegidaId, familia_actualizada: fields.getValue() };
      if (modo === "vinculada") return { familia_id: familiaActual.id };
      // "vinculada_editar"
      return { familia_id: familiaActual.id, familia_actualizada: fields.getValue() };
    },
    // Rellena "Crear familia nueva" con datos extraídos por OCR.
    prefillNueva(datos = {}) {
      prefillNuevaDatos = datos;
      modo = "nueva";
      familiaElegidaId = null;
      render();
    },
  };
}
