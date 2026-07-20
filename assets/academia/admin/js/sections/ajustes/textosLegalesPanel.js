import { buildIcon } from "../../icons.js";
import { fetchTextosLegales, createTextoLegal, updateTextoLegal, deleteTextoLegal } from "../../api.js";
import { buildPanelHead, buildPanelFoot } from "./panelChrome.js";

const TIPOS = [
  { value: "email", label: "Email" },
  { value: "recibos", label: "Recibos" },
  { value: "ambos", label: "Ambos" },
];

const GUARDADO_MS = 1700;

function buildTipoSelect(value) {
  const select = document.createElement("select");
  select.className = "ac-select ac-legal-tipo-select";
  for (const t of TIPOS) {
    const opt = document.createElement("option");
    opt.value = t.value;
    opt.textContent = t.label;
    select.appendChild(opt);
  }
  select.value = value;
  return select;
}

function buildActivoToggle(activo) {
  const label = document.createElement("label");
  label.className = "ac-toggle";
  const input = document.createElement("input");
  input.type = "checkbox";
  input.checked = activo;
  const span = document.createElement("span");
  span.textContent = "Activo";
  label.append(input, span);
  return { wrap: label, input };
}

function leerCampos(campos) {
  return {
    etiqueta: campos.etiqueta.value.trim(),
    tipo: campos.tipoSelect.value,
    contenido: campos.contenido.value,
    activo: campos.activoInput.checked,
  };
}

function difiereDeBaseline(actual, baseline) {
  return (
    actual.etiqueta !== baseline.etiqueta ||
    actual.tipo !== baseline.tipo ||
    actual.contenido !== baseline.contenido ||
    actual.activo !== baseline.activo
  );
}

// Una fila por texto: etiqueta editable inline, tipo (select: email/
// recibos/ambos), contenido (textarea) y toggle activo/inactivo. Nada se
// guarda de forma implícita (ni blur ni change) — los cuatro campos viajan
// juntos en un único guardado explícito por fila, con su propio botón
// "Guardar" (deshabilitado mientras no haya cambios sin guardar respecto a
// lo último persistido) y feedback "✓ Guardado", mismo patrón que
// inscripcion/textoPanel.js y facturacionTab.js.
function buildFila(textoInicial, { onActualizar, onEliminar }) {
  const item = document.createElement("div");
  item.className = "ac-legal-item";
  const id = textoInicial.id;
  let baseline = {
    etiqueta: textoInicial.etiqueta,
    tipo: textoInicial.tipo,
    contenido: textoInicial.contenido || "",
    activo: textoInicial.activo,
  };

  const head = document.createElement("div");
  head.className = "ac-legal-head";
  const etiqueta = document.createElement("input");
  etiqueta.className = "ac-legal-tag-input";
  etiqueta.value = baseline.etiqueta;

  const tipoSelect = buildTipoSelect(baseline.tipo);

  const eliminarBtn = document.createElement("button");
  eliminarBtn.type = "button";
  eliminarBtn.className = "ac-icon-btn danger";
  eliminarBtn.title = "Eliminar";
  eliminarBtn.appendChild(buildIcon("trash", { size: 14 }));
  eliminarBtn.addEventListener("click", () => onEliminar({ id }, item));

  head.append(etiqueta, tipoSelect, eliminarBtn);

  const contenido = document.createElement("textarea");
  contenido.className = "ac-textarea";
  contenido.rows = 2;
  contenido.value = baseline.contenido;

  const activoToggle = buildActivoToggle(baseline.activo);

  const { foot, hint } = buildPanelFoot();
  const saveBtn = document.createElement("button");
  saveBtn.type = "button";
  saveBtn.className = "ac-btn primary sm";
  saveBtn.textContent = "Guardar";
  saveBtn.disabled = true;
  foot.appendChild(saveBtn);

  item.append(head, contenido, activoToggle.wrap, foot);

  const campos = { etiqueta, tipoSelect, contenido, activoInput: activoToggle.input };

  function actualizarEstadoBoton() {
    saveBtn.disabled = !difiereDeBaseline(leerCampos(campos), baseline);
  }
  etiqueta.addEventListener("input", actualizarEstadoBoton);
  tipoSelect.addEventListener("change", actualizarEstadoBoton);
  contenido.addEventListener("input", actualizarEstadoBoton);
  activoToggle.input.addEventListener("change", actualizarEstadoBoton);

  saveBtn.addEventListener("click", async () => {
    saveBtn.disabled = true;
    try {
      const guardado = await onActualizar({ id, ...leerCampos(campos) });
      baseline = {
        etiqueta: guardado.etiqueta,
        tipo: guardado.tipo,
        contenido: guardado.contenido || "",
        activo: guardado.activo,
      };
      hint.textContent = "✓ Guardado";
      setTimeout(() => { hint.textContent = ""; }, GUARDADO_MS);
      actualizarEstadoBoton();
    } catch (err) {
      hint.textContent = err.message || "No se pudo guardar.";
      actualizarEstadoBoton();
    }
  });

  return item;
}

// Repositorio único de textos legales (LOPD, exención de IVA, avisos de
// impago...) — unifica lo que antes eran dos campos sueltos
// (texto_lopd/texto_exencion_iva en academia_config) en esta lista.
// plantillaEmail.js y buildReciboPreview leen de aquí (tipo "email"/
// "ambos" para el footer del email, "recibos"/"ambos" para la exención de
// IVA del recibo), filtrando solo los activos — ver
// academiaTextosLegales/consultas.js en el backend.
//
// Crear/eliminar filas nunca reconstruye la lista entera (evita perder
// ediciones sin guardar en otras filas): cada fila se añade/quita de forma
// puntual en el DOM.
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

  function mostrarVacioSiCorresponde() {
    if (listSlot.children.length > 0) return;
    const empty = document.createElement("p");
    empty.className = "ac-empty";
    empty.textContent = "Sin textos legales configurados todavía.";
    listSlot.appendChild(empty);
  }

  function quitarVacio() {
    listSlot.querySelector(".ac-empty")?.remove();
  }

  function renderListaInicial() {
    listSlot.innerHTML = "";
    if (!textos.length) { mostrarVacioSiCorresponde(); return; }
    for (const t of textos) {
      listSlot.appendChild(buildFila(t, { onActualizar: actualizar, onEliminar: eliminar }));
    }
  }

  async function actualizar(cambios) {
    const guardado = await updateTextoLegalFn(cambios.id, {
      etiqueta: cambios.etiqueta, tipo: cambios.tipo, contenido: cambios.contenido, activo: cambios.activo,
    });
    textos = textos.map((t) => (t.id === guardado.id ? guardado : t));
    return guardado;
  }

  async function eliminar(texto, itemNode) {
    try {
      await deleteTextoLegalFn(texto.id);
      textos = textos.filter((t) => t.id !== texto.id);
      itemNode.remove();
      mostrarVacioSiCorresponde();
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
      quitarVacio();
      listSlot.appendChild(buildFila(creado, { onActualizar: actualizar, onEliminar: eliminar }));
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
    .then((data) => { textos = data; renderListaInicial(); })
    .catch((err) => {
      listSlot.innerHTML = "";
      const error = document.createElement("p");
      error.className = "ac-error";
      error.textContent = err.message || "No se pudieron cargar los textos legales.";
      listSlot.appendChild(error);
    });

  return panel;
}
