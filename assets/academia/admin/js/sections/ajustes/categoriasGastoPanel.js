import { buildIcon } from "../../icons.js";
import { fetchGastoCategorias, createGastoCategoria, deleteGastoCategoria } from "../../apiFinanzas.js";
import { buildPanelHead, buildPanelFoot } from "./panelChrome.js";

function buildFila(categoria, { onEliminar }) {
  const row = document.createElement("div");
  row.className = "ac-disc-row";
  if (categoria.es_predefinida) row.style.opacity = "0.6";

  const main = document.createElement("div");
  main.className = "ac-disc-main";
  const nombre = document.createElement("span");
  nombre.className = "ac-disc-name";
  nombre.textContent = categoria.nombre;
  main.appendChild(nombre);
  if (categoria.es_predefinida) {
    const badge = document.createElement("span");
    badge.className = "ac-pill";
    badge.textContent = "Predefinida";
    main.appendChild(badge);
  }
  row.appendChild(main);

  if (!categoria.es_predefinida) {
    const eliminarBtn = document.createElement("button");
    eliminarBtn.type = "button";
    eliminarBtn.className = "ac-icon-btn danger";
    eliminarBtn.title = "Eliminar";
    eliminarBtn.appendChild(buildIcon("trash", { size: 14 }));
    eliminarBtn.addEventListener("click", () => onEliminar(categoria));
    row.appendChild(eliminarBtn);
  }

  return row;
}

// Formulario inline (no drawer) para añadir una categoría — mismo patrón
// que descuentosPanel.js.
function buildAddForm({ onGuardar, onCancelar }) {
  const wrap = document.createElement("div");
  wrap.className = "ac-panel";
  wrap.style.marginTop = "12px";

  const label = document.createElement("label");
  label.className = "ac-field-label";
  label.textContent = "Nombre de la categoría";
  const nombre = document.createElement("input");
  nombre.className = "ac-input";
  nombre.type = "text";
  nombre.maxLength = 50;
  wrap.append(label, nombre);

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
  guardarBtn.textContent = "Añadir";
  guardarBtn.addEventListener("click", async () => {
    const valor = nombre.value.trim();
    if (!valor) {
      msg.textContent = "Escribe un nombre.";
      msg.className = "ac-drawer-msg error";
      return;
    }
    guardarBtn.disabled = true;
    try {
      await onGuardar(valor);
    } catch (err) {
      msg.textContent = err.message || "No se pudo añadir la categoría.";
      msg.className = "ac-drawer-msg error";
      guardarBtn.disabled = false;
    }
  });

  acciones.append(cancelarBtn, guardarBtn);
  wrap.append(acciones, msg);
  return wrap;
}

// Tarjeta "Categorías de gastos" en Ajustes — las predefinidas (8 de
// fábrica, ver academia.gastos.categorias.routes.js) se muestran de solo
// lectura; las personalizadas del tenant se pueden borrar. Mismas
// categorías que usa el selector del drawer de gastos (ver
// gastoCategoriaSelect.js).
export function buildCategoriasGastoPanel() {
  const panel = document.createElement("div");
  panel.className = "ac-panel";
  panel.appendChild(buildPanelHead("Categorías de gastos", "Las categorías predefinidas no se pueden eliminar."));

  const listSlot = document.createElement("div");
  listSlot.className = "ac-disc-list";
  panel.appendChild(listSlot);

  const formSlot = document.createElement("div");
  panel.appendChild(formSlot);

  const addBtn = document.createElement("button");
  addBtn.type = "button";
  addBtn.className = "ac-btn ghost";
  addBtn.style.marginTop = "14px";
  addBtn.append(buildIcon("plus", { size: 13 }), document.createTextNode(" Añadir categoría"));
  panel.appendChild(addBtn);

  const { foot, hint } = buildPanelFoot();
  panel.appendChild(foot);

  let categorias = [];

  function renderLista() {
    listSlot.innerHTML = "";
    for (const c of categorias) listSlot.appendChild(buildFila(c, { onEliminar: eliminar }));
    hint.textContent = `${categorias.length} categorías · ${categorias.filter((c) => !c.es_predefinida).length} personalizadas`;
  }

  function mostrarFormulario() {
    formSlot.innerHTML = "";
    addBtn.disabled = true;
    formSlot.appendChild(
      buildAddForm({
        onCancelar: () => { formSlot.innerHTML = ""; addBtn.disabled = false; },
        onGuardar: async (nombre) => {
          const nueva = await createGastoCategoria(nombre);
          categorias = [...categorias, nueva];
          formSlot.innerHTML = "";
          addBtn.disabled = false;
          renderLista();
        },
      })
    );
  }

  async function eliminar(categoria) {
    if (!window.confirm(`¿Eliminar la categoría "${categoria.nombre}"?`)) return;
    try {
      await deleteGastoCategoria(categoria.id);
      categorias = categorias.filter((c) => c.id !== categoria.id);
      renderLista();
    } catch (err) {
      window.alert(err.message || "No se pudo eliminar la categoría.");
    }
  }

  addBtn.addEventListener("click", mostrarFormulario);

  const cargando = document.createElement("p");
  cargando.className = "ac-loading";
  cargando.textContent = "Cargando…";
  listSlot.appendChild(cargando);

  fetchGastoCategorias()
    .then((data) => { categorias = data; renderLista(); })
    .catch((err) => {
      listSlot.innerHTML = "";
      const error = document.createElement("p");
      error.className = "ac-error";
      error.textContent = err.message || "No se pudieron cargar las categorías.";
      listSlot.appendChild(error);
    });

  return panel;
}
