import { buildIcon } from "../icons.js";
import { fetchConfig, updateConfig } from "../api.js";
import { buildDescuentosPanel } from "./ajustes/descuentosPanel.js";

const PLANTILLA_EJEMPLOS = ["Clases {mes} {año}", "Clases {mes} en {academia}"];
const TEXTO_EXENCION_IVA_DEFAULT =
  "Servicio educativo exento de IVA según el artículo 20.Uno.9º de la Ley 37/1992 del IVA.";

// Datos de ejemplo — sin backend todavía.
const DATOS_FISCALES_MOCK = {
  nombre: "Academia Lyceo S.L.",
  nif: "B12345678",
  direccion: "Calle Mayor 12, 28001 Madrid",
  telefono: "910 000 000",
  email: "administracion@academialyceo.es",
  iban: "ES00 0000 0000 0000 0000 0000",
  bizum: "612 345 678",
};

const FRANJAS_MOCK = [
  { id: "f1", inicio: "15:30", fin: "16:30" },
  { id: "f2", inicio: "16:30", fin: "17:30" },
  { id: "f3", inicio: "17:30", fin: "18:30" },
  { id: "f4", inicio: "18:30", fin: "19:30" },
  { id: "f5", inicio: "19:30", fin: "20:30" },
];

function buildField(label, attrs = {}) {
  const wrap = document.createElement("div");
  wrap.className = "ac-field";
  const span = document.createElement("label");
  span.className = "ac-field-label";
  span.textContent = label;
  wrap.appendChild(span);
  const input = document.createElement("input");
  input.className = "ac-input";
  Object.entries(attrs).forEach(([key, value]) => { input[key] = value; });
  wrap.appendChild(input);
  return { wrap, input };
}

function buildDatosFiscalesPanel() {
  const panel = document.createElement("div");
  panel.className = "ac-panel";
  const title = document.createElement("div");
  title.className = "ac-panel-title";
  title.textContent = "Datos fiscales del emisor";
  panel.appendChild(title);

  const nombre = buildField("Nombre / razón social", { type: "text", value: DATOS_FISCALES_MOCK.nombre });
  const nif = buildField("NIF", { type: "text", value: DATOS_FISCALES_MOCK.nif });
  const direccion = buildField("Dirección", { type: "text", value: DATOS_FISCALES_MOCK.direccion });
  const telefono = buildField("Teléfono", { type: "text", value: DATOS_FISCALES_MOCK.telefono });
  const email = buildField("Email", { type: "email", value: DATOS_FISCALES_MOCK.email });
  const iban = buildField("IBAN", { type: "text", value: DATOS_FISCALES_MOCK.iban });
  const bizum = buildField("Bizum", { type: "text", value: DATOS_FISCALES_MOCK.bizum });
  panel.append(nombre.wrap, nif.wrap, direccion.wrap, telefono.wrap, email.wrap, iban.wrap, bizum.wrap);

  const msg = document.createElement("div");
  msg.className = "ac-drawer-msg";
  const saveBtn = document.createElement("button");
  saveBtn.type = "button";
  saveBtn.className = "ac-btn primary";
  saveBtn.textContent = "Guardar";
  saveBtn.addEventListener("click", () => {
    msg.textContent = "✓ Guardado (datos de ejemplo — sin backend todavía).";
    msg.className = "ac-drawer-msg ok";
  });
  panel.append(saveBtn, msg);

  return panel;
}

function buildFranjaRow(franja, onEliminar) {
  const row = document.createElement("div");
  row.className = "ac-franja-row";

  const inicio = document.createElement("input");
  inicio.type = "time";
  inicio.className = "ac-input";
  inicio.value = franja.inicio;

  const sep = document.createElement("span");
  sep.textContent = "–";

  const fin = document.createElement("input");
  fin.type = "time";
  fin.className = "ac-input";
  fin.value = franja.fin;

  const delBtn = document.createElement("button");
  delBtn.type = "button";
  delBtn.className = "ac-icon-btn danger";
  delBtn.title = "Eliminar franja";
  delBtn.appendChild(buildIcon("trash", { size: 14 }));
  delBtn.addEventListener("click", () => onEliminar(franja.id));

  row.append(inicio, sep, fin, delBtn);
  return row;
}

function buildFranjasPanel() {
  let franjas = [...FRANJAS_MOCK];

  const panel = document.createElement("div");
  panel.className = "ac-panel";
  const title = document.createElement("div");
  title.className = "ac-panel-title";
  title.textContent = "Franjas horarias";
  panel.appendChild(title);

  const listSlot = document.createElement("div");
  panel.appendChild(listSlot);

  function renderLista() {
    listSlot.innerHTML = "";
    for (const franja of franjas) {
      listSlot.appendChild(
        buildFranjaRow(franja, (id) => {
          franjas = franjas.filter((f) => f.id !== id);
          renderLista();
        })
      );
    }
  }
  renderLista();

  const addBtn = document.createElement("button");
  addBtn.type = "button";
  addBtn.className = "ac-btn ghost";
  addBtn.style.marginTop = "8px";
  addBtn.append(buildIcon("plus", { size: 13 }), document.createTextNode(" Añadir franja"));
  addBtn.addEventListener("click", () => {
    franjas = [...franjas, { id: `f_${Date.now()}`, inicio: "09:00", fin: "10:00" }];
    renderLista();
  });
  panel.appendChild(addBtn);

  return panel;
}

function buildTextareaField(label, attrs = {}) {
  const wrap = document.createElement("div");
  wrap.className = "ac-field";
  const span = document.createElement("label");
  span.className = "ac-field-label";
  span.textContent = label;
  wrap.appendChild(span);
  const textarea = document.createElement("textarea");
  textarea.className = "ac-textarea";
  Object.entries(attrs).forEach(([key, value]) => { textarea[key] = value; });
  wrap.appendChild(textarea);
  return { wrap, input: textarea };
}

function buildChip(texto, onClick) {
  const chip = document.createElement("button");
  chip.type = "button";
  chip.className = "ac-pill";
  chip.style.fontSize = "11px";
  chip.textContent = texto;
  chip.addEventListener("click", () => onClick(texto));
  return chip;
}

// A diferencia de los otros dos paneles (datos fiscales y franjas, que
// siguen siendo mock), este sí lee/escribe academia_config de verdad.
function buildRecibosPanel() {
  const panel = document.createElement("div");
  panel.className = "ac-panel";
  const title = document.createElement("div");
  title.className = "ac-panel-title";
  title.textContent = "Recibos";
  panel.appendChild(title);

  const cargando = document.createElement("p");
  cargando.className = "ac-loading";
  cargando.textContent = "Cargando…";
  panel.appendChild(cargando);

  function renderContenido(config) {
    cargando.remove();

    const plantilla = buildField("Plantilla de concepto", {
      type: "text",
      placeholder: "Clases {mes} {año}",
      value: config.concepto_recibo_plantilla || "",
    });
    panel.appendChild(plantilla.wrap);

    const chips = document.createElement("div");
    chips.style.display = "flex";
    chips.style.gap = "8px";
    chips.style.margin = "-6px 0 14px";
    for (const ejemplo of PLANTILLA_EJEMPLOS) {
      chips.appendChild(buildChip(ejemplo, (texto) => { plantilla.input.value = texto; }));
    }
    panel.appendChild(chips);

    const exencion = buildTextareaField("Texto de exención de IVA", {
      rows: 3,
      value: config.texto_exencion_iva || TEXTO_EXENCION_IVA_DEFAULT,
    });
    panel.appendChild(exencion.wrap);

    const descuento = buildField("Descuento por hermanos (%)", {
      type: "number", min: "0", max: "100", step: "1",
      value: config.descuento_hermanos_pct || 0,
    });
    panel.appendChild(descuento.wrap);

    const msg = document.createElement("div");
    msg.className = "ac-drawer-msg";
    const saveBtn = document.createElement("button");
    saveBtn.type = "button";
    saveBtn.className = "ac-btn primary";
    saveBtn.textContent = "Guardar";
    saveBtn.addEventListener("click", async () => {
      saveBtn.disabled = true;
      msg.textContent = "";
      try {
        await updateConfig({
          concepto_recibo_plantilla: plantilla.input.value.trim() || "Clases {mes} {año}",
          texto_exencion_iva: exencion.input.value.trim(),
          descuento_hermanos_pct: Number(descuento.input.value) || 0,
        });
        msg.textContent = "✓ Guardado";
        msg.className = "ac-drawer-msg ok";
      } catch (err) {
        msg.textContent = err.message || "No se pudo guardar.";
        msg.className = "ac-drawer-msg error";
      }
      saveBtn.disabled = false;
    });
    panel.append(saveBtn, msg);
  }

  fetchConfig()
    .then((config) => renderContenido(config || {}))
    .catch((err) => {
      cargando.textContent = err.message || "No se pudo cargar la configuración.";
      cargando.className = "ac-error";
    });

  return panel;
}

export function renderAjustesSection(container) {
  if (!container) return;
  container.innerHTML = "";

  const head = document.createElement("div");
  head.className = "ac-body-head";
  const title = document.createElement("h1");
  title.className = "ac-title";
  title.textContent = "Ajustes";
  head.appendChild(title);
  container.appendChild(head);

  const grid = document.createElement("div");
  grid.className = "ac-settings-grid";
  grid.append(buildDatosFiscalesPanel(), buildFranjasPanel(), buildRecibosPanel(), buildDescuentosPanel());
  container.appendChild(grid);
}
