import { buildIcon } from "../../icons.js";
import { fetchTextosLegales, createTextoLegal, updateTextoLegal, deleteTextoLegal } from "../../api.js";
import { buildPanelHead } from "./panelChrome.js";

const TIPOS = [
  { value: "email", label: "Email" },
  { value: "recibos", label: "Recibos" },
  { value: "ambos", label: "Ambos" },
];

function buildTipoSelect(value, onChange) {
  const select = document.createElement("select");
  select.className = "ac-select ac-legal-tipo-select";
  for (const t of TIPOS) {
    const opt = document.createElement("option");
    opt.value = t.value;
    opt.textContent = t.label;
    select.appendChild(opt);
  }
  select.value = value;
  select.addEventListener("change", () => onChange(select.value));
  return select;
}

function buildActivoToggle(activo, onChange) {
  const label = document.createElement("label");
  label.className = "ac-toggle";
  const input = document.createElement("input");
  input.type = "checkbox";
  input.checked = activo;
  const span = document.createElement("span");
  span.textContent = "Activo";
  label.append(input, span);
  input.addEventListener("change", () => onChange(input.checked));
  return label;
}

// Una fila por texto: etiqueta editable inline, tipo (select: email/
// recibos/ambos), contenido (textarea) y toggle activo/inactivo — cada
// cambio se guarda al instante (blur en los campos de texto, change en
// select/checkbox), sin botón "Guardar" por fila.
function buildFila(texto, { onActualizar, onEliminar }) {
  const item = document.createElement("div");
  item.className = "ac-legal-item";

  const head = document.createElement("div");
  head.className = "ac-legal-head";
  const etiqueta = document.createElement("input");
  etiqueta.className = "ac-legal-tag-input";
  etiqueta.value = texto.etiqueta;
  etiqueta.addEventListener("blur", () => {
    if (etiqueta.value.trim() && etiqueta.value.trim() !== texto.etiqueta) {
      onActualizar({ ...texto, etiqueta: etiqueta.value.trim() });
    }
  });

  const tipoSelect = buildTipoSelect(texto.tipo, (tipo) => onActualizar({ ...texto, tipo }));

  const eliminarBtn = document.createElement("button");
  eliminarBtn.type = "button";
  eliminarBtn.className = "ac-icon-btn danger";
  eliminarBtn.title = "Eliminar";
  eliminarBtn.appendChild(buildIcon("trash", { size: 14 }));
  eliminarBtn.addEventListener("click", () => onEliminar(texto));

  head.append(etiqueta, tipoSelect, eliminarBtn);

  const contenido = document.createElement("textarea");
  contenido.className = "ac-textarea";
  contenido.rows = 2;
  contenido.value = texto.contenido || "";
  contenido.addEventListener("blur", () => {
    if (contenido.value !== texto.contenido) onActualizar({ ...texto, contenido: contenido.value });
  });

  const activoToggle = buildActivoToggle(texto.activo, (activo) => onActualizar({ ...texto, activo }));

  item.append(head, contenido, activoToggle);
  return item;
}

// Repositorio único de textos legales (LOPD, exención de IVA, avisos de
// impago...) — unifica lo que antes eran dos campos sueltos
// (texto_lopd/texto_exencion_iva en academia_config) en esta lista.
// plantillaEmail.js y buildReciboPreview leen de aquí (tipo "email"/
// "ambos" para el footer del email, "recibos"/"ambos" para la exención de
// IVA del recibo), filtrando solo los activos — ver
// academiaTextosLegales/consultas.js en el backend.
export function buildTextosLegalesPanel({
  fetchTextosLegalesFn = fetchTextosLegales,
  createTextoLegalFn = createTextoLegal,
  updateTextoLegalFn = updateTextoLegal,
  deleteTextoLegalFn = deleteTextoLegal,
} = {}) {
  const panel = document.createElement("div");
  panel.className = "ac-panel";
  panel.appendChild(buildPanelHead("Textos legales", "Leyendas configurables (LOPD, avisos, exenciones) reutilizables en recibos y emails."));

  const listSlot = document.createElement("div");
  listSlot.className = "ac-legal-list";
  panel.appendChild(listSlot);

  let textos = [];

  function renderLista() {
    listSlot.innerHTML = "";
    if (!textos.length) {
      const empty = document.createElement("p");
      empty.className = "ac-empty";
      empty.textContent = "Sin textos legales configurados todavía.";
      listSlot.appendChild(empty);
      return;
    }
    for (const t of textos) {
      listSlot.appendChild(buildFila(t, { onActualizar: actualizar, onEliminar: eliminar }));
    }
  }

  async function actualizar(texto) {
    try {
      const guardado = await updateTextoLegalFn(texto.id, {
        etiqueta: texto.etiqueta, tipo: texto.tipo, contenido: texto.contenido, activo: texto.activo,
      });
      textos = textos.map((t) => (t.id === guardado.id ? guardado : t));
      renderLista();
    } catch (err) {
      window.alert(err.message || "No se pudo guardar el texto.");
    }
  }

  async function eliminar(texto) {
    try {
      await deleteTextoLegalFn(texto.id);
      textos = textos.filter((t) => t.id !== texto.id);
      renderLista();
    } catch (err) {
      window.alert(err.message || "No se pudo eliminar el texto.");
    }
  }

  const footRow = document.createElement("div");
  footRow.className = "ac-panel-foot";
  const addBtn = document.createElement("button");
  addBtn.type = "button";
  addBtn.className = "ac-btn ghost";
  addBtn.append(buildIcon("plus", { size: 13 }), document.createTextNode(" Añadir texto"));
  addBtn.addEventListener("click", async () => {
    addBtn.disabled = true;
    try {
      const creado = await createTextoLegalFn({ etiqueta: "Nuevo texto", tipo: "recibos", contenido: "" });
      textos = [...textos, creado];
      renderLista();
    } catch (err) {
      window.alert(err.message || "No se pudo crear el texto.");
    }
    addBtn.disabled = false;
  });
  footRow.appendChild(addBtn);
  panel.appendChild(footRow);

  const cargando = document.createElement("p");
  cargando.className = "ac-loading";
  cargando.textContent = "Cargando…";
  listSlot.appendChild(cargando);

  fetchTextosLegalesFn()
    .then((data) => { textos = data; renderLista(); })
    .catch((err) => {
      listSlot.innerHTML = "";
      const error = document.createElement("p");
      error.className = "ac-error";
      error.textContent = err.message || "No se pudieron cargar los textos legales.";
      listSlot.appendChild(error);
    });

  return panel;
}
