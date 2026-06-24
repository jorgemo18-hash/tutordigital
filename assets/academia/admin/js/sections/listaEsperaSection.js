import { CURSOS } from "../curso.js";
import { buildIcon } from "../icons.js";

// Datos de ejemplo — sin backend todavía (PASO siguiente conecta esto a la API real).
const MOCK_INICIAL = [
  { id: "le1", nombre: "Marta Pérez", curso: "3º ESO", contacto: "612 345 678", notas: "Prefiere tardes" },
  { id: "le2", nombre: "Diego Ruiz", curso: "5º PRIM", contacto: "diego.ruiz@gmail.com", notas: "" },
  { id: "le3", nombre: "Aitana Soto", curso: "1º BACH", contacto: "611 222 333", notas: "Viene recomendada por Marta" },
];

function buildHead() {
  const head = document.createElement("div");
  head.className = "ac-body-head";
  const title = document.createElement("h1");
  title.className = "ac-title";
  title.textContent = "Lista de espera";
  head.appendChild(title);
  return head;
}

function buildForm(onAdd) {
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

  const contactoInput = document.createElement("input");
  contactoInput.type = "text";
  contactoInput.className = "ac-input";
  contactoInput.placeholder = "Teléfono o email";

  row.append(nombreInput, cursoSelect, contactoInput);
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
  addBtn.addEventListener("click", () => {
    const nombre = nombreInput.value.trim();
    if (!nombre) return;
    onAdd({
      nombre,
      curso: cursoSelect.value,
      contacto: contactoInput.value.trim(),
      notas: notasInput.value.trim(),
    });
    nombreInput.value = "";
    cursoSelect.value = "";
    contactoInput.value = "";
    notasInput.value = "";
  });
  form.appendChild(addBtn);

  return form;
}

function buildTable(entradas, onEliminar) {
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
    tdContacto.textContent = entrada.contacto || "—";
    const tdNotas = document.createElement("td");
    tdNotas.textContent = entrada.notas || "—";
    const tdAccion = document.createElement("td");
    const delBtn = document.createElement("button");
    delBtn.type = "button";
    delBtn.className = "ac-icon-btn danger";
    delBtn.title = "Eliminar";
    delBtn.appendChild(buildIcon("trash", { size: 14 }));
    delBtn.addEventListener("click", () => onEliminar(entrada.id));
    tdAccion.appendChild(delBtn);
    tr.append(tdNombre, tdCurso, tdContacto, tdNotas, tdAccion);
    tbody.appendChild(tr);
  }
  table.appendChild(tbody);
  wrap.appendChild(table);
  return wrap;
}

export function renderListaEsperaSection(container) {
  if (!container) return;
  let entradas = [...MOCK_INICIAL];

  container.innerHTML = "";
  container.appendChild(buildHead());
  container.appendChild(
    buildForm((nuevo) => {
      entradas = [...entradas, { ...nuevo, id: `le_${Date.now()}` }];
      renderTabla();
    })
  );

  const tableSlot = document.createElement("div");
  container.appendChild(tableSlot);

  function renderTabla() {
    tableSlot.innerHTML = "";
    tableSlot.appendChild(
      buildTable(entradas, (id) => {
        entradas = entradas.filter((e) => e.id !== id);
        renderTabla();
      })
    );
  }
  renderTabla();
}
