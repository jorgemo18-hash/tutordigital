import { CURSOS } from "../curso.js";
import { buildIcon } from "../icons.js";
import {
  fetchListaEspera,
  crearEntradaListaEspera,
  eliminarEntradaListaEspera,
} from "../apiListaEspera.js";

function buildHead() {
  const head = document.createElement("div");
  head.className = "ac-body-head";
  const title = document.createElement("h1");
  title.className = "ac-title";
  title.textContent = "Lista de espera";
  head.appendChild(title);
  return head;
}

// Mismo patrón que createSustitucionesSection: deps inyectables para
// test, un único msgEl reutilizado para el feedback de añadir/eliminar.
export function createListaEsperaSection({
  fetchListaEsperaFn = fetchListaEspera,
  crearEntradaFn = crearEntradaListaEspera,
  eliminarEntradaFn = eliminarEntradaListaEspera,
} = {}) {
  let tableSlot = null;
  let msgEl = null;
  let campos = null;

  function buildForm() {
    const form = document.createElement("div");
    form.className = "ac-panel";
    form.style.marginBottom = "18px";

    const row = document.createElement("div");
    row.className = "ac-field-row three";

    const nombreInput = document.createElement("input");
    nombreInput.type = "text";
    nombreInput.className = "ac-input";
    nombreInput.placeholder = "Nombre";

    const cursoSelect = document.createElement("select");
    cursoSelect.className = "ac-select";
    const blank = document.createElement("option");
    blank.value = "";
    blank.textContent = "Curso…";
    cursoSelect.appendChild(blank);
    for (const c of CURSOS) {
      const opt = document.createElement("option");
      opt.value = c;
      opt.textContent = c;
      cursoSelect.appendChild(opt);
    }

    const telefonoInput = document.createElement("input");
    telefonoInput.type = "text";
    telefonoInput.className = "ac-input";
    telefonoInput.placeholder = "Teléfono o email";

    row.append(nombreInput, cursoSelect, telefonoInput);
    form.appendChild(row);

    const notasInput = document.createElement("input");
    notasInput.type = "text";
    notasInput.className = "ac-input";
    notasInput.placeholder = "Notas (opcional)";
    notasInput.style.marginTop = "10px";
    form.appendChild(notasInput);

    const addBtn = document.createElement("button");
    addBtn.type = "button";
    addBtn.className = "ac-btn primary";
    addBtn.style.marginTop = "12px";
    addBtn.append(buildIcon("plus", { size: 14 }), document.createTextNode(" Añadir a la lista"));
    addBtn.addEventListener("click", onAdd);
    form.appendChild(addBtn);

    campos = { form, nombreInput, cursoSelect, telefonoInput, notasInput, addBtn };
    return form;
  }

  async function onAdd() {
    const nombre = campos.nombreInput.value.trim();
    if (!nombre) return;

    msgEl.textContent = "";
    campos.addBtn.disabled = true;
    try {
      await crearEntradaFn({
        nombre,
        curso: campos.cursoSelect.value,
        telefono: campos.telefonoInput.value.trim(),
        notas: campos.notasInput.value.trim(),
      });
      campos.nombreInput.value = "";
      campos.cursoSelect.value = "";
      campos.telefonoInput.value = "";
      campos.notasInput.value = "";
      await cargarTabla();
    } catch (err) {
      msgEl.textContent = err.message || "No se pudo añadir a la lista de espera.";
      msgEl.className = "ac-drawer-msg error";
    } finally {
      campos.addBtn.disabled = false;
    }
  }

  async function onEliminar(id, delBtn) {
    msgEl.textContent = "";
    delBtn.disabled = true;
    try {
      await eliminarEntradaFn(id);
      await cargarTabla();
    } catch (err) {
      msgEl.textContent = err.message || "No se pudo eliminar de la lista de espera.";
      msgEl.className = "ac-drawer-msg error";
      delBtn.disabled = false;
    }
  }

  function buildTable(entradas) {
    const wrap = document.createElement("div");
    wrap.className = "ac-table-wrap";
    if (!entradas.length) {
      const empty = document.createElement("p");
      empty.className = "ac-empty";
      empty.textContent = "La lista de espera está vacía.";
      wrap.appendChild(empty);
      return wrap;
    }

    const table = document.createElement("table");
    table.className = "ac-table";
    const thead = document.createElement("thead");
    thead.innerHTML = "<tr><th>Nombre</th><th>Curso</th><th>Contacto</th><th>Notas</th><th></th></tr>";
    table.appendChild(thead);

    const tbody = document.createElement("tbody");
    for (const entrada of entradas) {
      const tr = document.createElement("tr");
      const tdNombre = document.createElement("td");
      tdNombre.textContent = entrada.nombre;
      const tdCurso = document.createElement("td");
      tdCurso.textContent = entrada.curso || "—";
      const tdContacto = document.createElement("td");
      tdContacto.textContent = entrada.telefono || "—";
      const tdNotas = document.createElement("td");
      tdNotas.textContent = entrada.notas || "—";
      const tdAccion = document.createElement("td");
      const delBtn = document.createElement("button");
      delBtn.type = "button";
      delBtn.className = "ac-icon-btn danger";
      delBtn.title = "Eliminar";
      delBtn.appendChild(buildIcon("trash", { size: 14 }));
      delBtn.addEventListener("click", () => onEliminar(entrada.id, delBtn));
      tdAccion.appendChild(delBtn);
      tr.append(tdNombre, tdCurso, tdContacto, tdNotas, tdAccion);
      tbody.appendChild(tr);
    }
    table.appendChild(tbody);
    wrap.appendChild(table);
    return wrap;
  }

  async function cargarTabla() {
    tableSlot.innerHTML = "";
    tableSlot.appendChild(Object.assign(document.createElement("p"), { className: "ac-loading", textContent: "Cargando…" }));
    try {
      const entradas = await fetchListaEsperaFn();
      tableSlot.innerHTML = "";
      // .ac-table-wrap solo da overflow-x:auto — sin envolverlo en .ac-panel
      // la tabla queda directamente sobre la foto de fondo del panel.
      const panel = document.createElement("div");
      panel.className = "ac-panel";
      panel.appendChild(buildTable(entradas));
      tableSlot.appendChild(panel);
    } catch (err) {
      tableSlot.innerHTML = "";
      tableSlot.appendChild(Object.assign(document.createElement("p"), { className: "ac-error", textContent: err.message || "No se pudo cargar la lista de espera." }));
    }
  }

  function render(container) {
    if (!container) return;
    container.innerHTML = "";
    container.appendChild(buildHead());

    msgEl = document.createElement("span");
    msgEl.className = "ac-drawer-msg";
    container.appendChild(msgEl);

    container.appendChild(buildForm());

    tableSlot = document.createElement("div");
    container.appendChild(tableSlot);
    cargarTabla();
  }

  return { render };
}
