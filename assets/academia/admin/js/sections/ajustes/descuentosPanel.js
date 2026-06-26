import { buildIcon } from "../../icons.js";
import { fetchDescuentosTipo, createDescuentoTipo, updateDescuentoTipo, deleteDescuentoTipo } from "../../api.js";

const INTERVALOS = [
  { value: "primer_mes", label: "Primer mes" },
  { value: "primer_trimestre", label: "Primer trimestre" },
  { value: "siempre", label: "Siempre" },
];

function intervaloLabel(value) {
  return INTERVALOS.find((i) => i.value === value)?.label || value;
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

function buildIntervaloSelect(value) {
  const field = buildField("Intervalo", "select");
  for (const i of INTERVALOS) {
    const opt = document.createElement("option");
    opt.value = i.value;
    opt.textContent = i.label;
    field.input.appendChild(opt);
  }
  field.input.value = value || "siempre";
  return field;
}

function buildAcumulableToggle(checked) {
  const label = document.createElement("label");
  label.className = "ac-toggle";
  const input = document.createElement("input");
  input.type = "checkbox";
  input.checked = checked ?? true;
  const span = document.createElement("span");
  span.textContent = "Acumulable con otros descuentos";
  label.append(input, span);
  return { wrap: label, input };
}

// Formulario inline (no drawer) para crear/editar un tipo de descuento.
// `onGuardar(datos)` es async — este componente solo gestiona sus propios
// botones/mensaje, la llamada a la API vive en quien lo invoca.
function buildFormulario(descuentoActual, { onGuardar, onCancelar }) {
  const wrap = document.createElement("div");
  wrap.className = "ac-panel";
  wrap.style.marginTop = "12px";

  const concepto = buildField("Concepto", "input", { type: "text", value: descuentoActual?.concepto || "" });
  const porcentaje = buildField("Porcentaje (%)", "input", {
    type: "number", min: "0.01", max: "100", step: "0.01", value: descuentoActual?.porcentaje ?? "",
  });
  const intervalo = buildIntervaloSelect(descuentoActual?.intervalo);
  const acumulable = buildAcumulableToggle(descuentoActual?.acumulable ?? true);
  wrap.append(concepto.wrap, porcentaje.wrap, intervalo.wrap, acumulable.wrap);

  const msg = document.createElement("div");
  msg.className = "ac-drawer-msg";

  const acciones = document.createElement("div");
  acciones.style.display = "flex";
  acciones.style.gap = "8px";
  acciones.style.marginTop = "10px";

  const cancelarBtn = document.createElement("button");
  cancelarBtn.type = "button";
  cancelarBtn.className = "ac-btn ghost";
  cancelarBtn.textContent = "Cancelar";
  cancelarBtn.addEventListener("click", onCancelar);

  const guardarBtn = document.createElement("button");
  guardarBtn.type = "button";
  guardarBtn.className = "ac-btn primary";
  guardarBtn.textContent = "Guardar";
  guardarBtn.addEventListener("click", async () => {
    const datos = {
      concepto: concepto.input.value.trim(),
      porcentaje: Number(porcentaje.input.value) || 0,
      intervalo: intervalo.input.value,
      acumulable: acumulable.input.checked,
    };
    if (!datos.concepto || datos.porcentaje <= 0) {
      msg.textContent = "Concepto y porcentaje (mayor que 0) son obligatorios.";
      msg.className = "ac-drawer-msg error";
      return;
    }
    guardarBtn.disabled = true;
    try {
      await onGuardar(datos);
    } catch (err) {
      msg.textContent = err.message || "No se pudo guardar.";
      msg.className = "ac-drawer-msg error";
      guardarBtn.disabled = false;
    }
  });

  acciones.append(cancelarBtn, guardarBtn);
  wrap.append(acciones, msg);
  return wrap;
}

function buildFila(descuento, { onEditar, onEliminar }) {
  const row = document.createElement("div");
  row.className = "ac-descuento-row";

  const concepto = document.createElement("span");
  concepto.className = "ac-descuento-concepto";
  concepto.textContent = descuento.concepto;
  row.appendChild(concepto);

  const porcentaje = document.createElement("span");
  porcentaje.className = "ac-descuento-porcentaje";
  porcentaje.textContent = `${Number(descuento.porcentaje).toFixed(2)}%`;
  row.appendChild(porcentaje);

  const intervalo = document.createElement("span");
  intervalo.className = "ac-lv bach";
  intervalo.textContent = intervaloLabel(descuento.intervalo);
  row.appendChild(intervalo);

  const acumulable = document.createElement("span");
  acumulable.className = "ac-descuento-acumulable";
  acumulable.title = descuento.acumulable ? "Acumulable" : "No acumulable";
  acumulable.appendChild(descuento.acumulable ? buildIcon("check", { size: 13 }) : document.createTextNode("—"));
  row.appendChild(acumulable);

  const editarBtn = document.createElement("button");
  editarBtn.type = "button";
  editarBtn.className = "ac-btn ghost sm";
  editarBtn.textContent = "Editar";
  editarBtn.addEventListener("click", () => onEditar(descuento));
  row.appendChild(editarBtn);

  const eliminarBtn = document.createElement("button");
  eliminarBtn.type = "button";
  eliminarBtn.className = "ac-icon-btn danger";
  eliminarBtn.title = "Eliminar";
  eliminarBtn.appendChild(buildIcon("trash", { size: 14 }));
  eliminarBtn.addEventListener("click", () => onEliminar(descuento));
  row.appendChild(eliminarBtn);

  return row;
}

// Tarjeta "Descuentos recurrentes" en Ajustes — tipos configurables por
// tenant (p.ej. "Pago anticipado 5%"). Se asignan luego por alumno en la
// sección DESCUENTOS RECURRENTES del drawer (ver tarifaSection.js) y se
// aplican automáticamente al generar recibos.
export function buildDescuentosPanel() {
  const panel = document.createElement("div");
  panel.className = "ac-panel";
  const title = document.createElement("div");
  title.className = "ac-panel-title";
  title.textContent = "Descuentos recurrentes";
  panel.appendChild(title);

  const listSlot = document.createElement("div");
  panel.appendChild(listSlot);

  const formSlot = document.createElement("div");
  panel.appendChild(formSlot);

  const addBtn = document.createElement("button");
  addBtn.type = "button";
  addBtn.className = "ac-btn ghost";
  addBtn.style.marginTop = "10px";
  addBtn.append(buildIcon("plus", { size: 13 }), document.createTextNode(" Añadir descuento"));
  panel.appendChild(addBtn);

  let descuentos = [];

  function renderLista() {
    listSlot.innerHTML = "";
    if (!descuentos.length) {
      const empty = document.createElement("p");
      empty.className = "ac-empty";
      empty.textContent = "Sin descuentos configurados todavía.";
      listSlot.appendChild(empty);
      return;
    }
    for (const d of descuentos) {
      listSlot.appendChild(
        buildFila(d, { onEditar: mostrarFormulario, onEliminar: eliminar })
      );
    }
  }

  function mostrarFormulario(descuentoActual) {
    formSlot.innerHTML = "";
    addBtn.disabled = true;
    formSlot.appendChild(
      buildFormulario(descuentoActual, {
        onCancelar: () => { formSlot.innerHTML = ""; addBtn.disabled = false; },
        onGuardar: async (datos) => {
          const guardado = descuentoActual
            ? await updateDescuentoTipo(descuentoActual.id, datos)
            : await createDescuentoTipo(datos);
          descuentos = descuentoActual
            ? descuentos.map((d) => (d.id === guardado.id ? guardado : d))
            : [...descuentos, guardado];
          formSlot.innerHTML = "";
          addBtn.disabled = false;
          renderLista();
        },
      })
    );
  }

  async function eliminar(descuento) {
    try {
      await deleteDescuentoTipo(descuento.id);
      descuentos = descuentos.filter((d) => d.id !== descuento.id);
      renderLista();
    } catch (err) {
      window.alert(err.message || "No se pudo eliminar el descuento.");
    }
  }

  addBtn.addEventListener("click", () => mostrarFormulario(null));

  const cargando = document.createElement("p");
  cargando.className = "ac-loading";
  cargando.textContent = "Cargando…";
  listSlot.appendChild(cargando);

  fetchDescuentosTipo()
    .then((data) => { descuentos = data; renderLista(); })
    .catch((err) => {
      listSlot.innerHTML = "";
      const error = document.createElement("p");
      error.className = "ac-error";
      error.textContent = err.message || "No se pudieron cargar los descuentos.";
      listSlot.appendChild(error);
    });

  return panel;
}
