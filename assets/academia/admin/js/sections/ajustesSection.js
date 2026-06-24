import { buildIcon } from "../icons.js";

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
  grid.append(buildDatosFiscalesPanel(), buildFranjasPanel());
  container.appendChild(grid);
}
