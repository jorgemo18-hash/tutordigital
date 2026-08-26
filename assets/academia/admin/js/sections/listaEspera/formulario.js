import { CURSOS } from "../../curso.js";
import { buildIcon } from "../../icons.js";

// Formulario de alta de la lista de espera. Separado de la sección porque
// ahora la tabla también construye campos (edición en línea) y las dos
// cosas juntas pasaban de las 400 líneas.
//
// `email` es un campo propio y no "Teléfono o email" en la misma casilla:
// son dos datos distintos y el aviso de plaza libre se manda por uno o por
// el otro (ver migración 107).

export function buildSelectCurso(valor = "") {
  const select = document.createElement("select");
  select.className = "ac-select";
  const blank = document.createElement("option");
  blank.value = "";
  blank.textContent = "Curso…";
  select.appendChild(blank);
  for (const c of CURSOS) {
    const opt = document.createElement("option");
    opt.value = c;
    opt.textContent = c;
    select.appendChild(opt);
  }
  select.value = valor || "";
  return select;
}

export function buildInput(placeholder, valor = "", { type = "text" } = {}) {
  const input = document.createElement("input");
  input.type = type;
  input.className = "ac-input";
  input.placeholder = placeholder;
  input.value = valor || "";
  return input;
}

// `onAdd` recibe los valores ya recogidos; el formulario no sabe nada de
// la API. Devuelve además `limpiar()` y `setOcupado()` para que la sección
// controle el ciclo de la petición sin tocar los nodos por dentro.
export function buildFormularioAlta({ onAdd }) {
  const form = document.createElement("div");
  form.className = "ac-panel";
  form.style.marginBottom = "18px";

  const fila1 = document.createElement("div");
  fila1.className = "ac-field-row three";
  const nombreInput = buildInput("Nombre");
  const cursoSelect = buildSelectCurso();
  const telefonoInput = buildInput("Teléfono");
  fila1.append(nombreInput, cursoSelect, telefonoInput);

  const fila2 = document.createElement("div");
  fila2.className = "ac-field-row";
  fila2.style.marginTop = "10px";
  const emailInput = buildInput("Email (opcional)", "", { type: "email" });
  const notasInput = buildInput("Notas (opcional)");
  fila2.append(emailInput, notasInput);

  const addBtn = document.createElement("button");
  addBtn.type = "button";
  addBtn.className = "ac-btn primary";
  addBtn.style.marginTop = "12px";
  addBtn.append(buildIcon("plus", { size: 14 }), document.createTextNode(" Añadir a la lista"));

  form.append(fila1, fila2, addBtn);

  function valores() {
    return {
      nombre: nombreInput.value.trim(),
      curso: cursoSelect.value,
      telefono: telefonoInput.value.trim(),
      email: emailInput.value.trim(),
      notas: notasInput.value.trim(),
    };
  }

  function limpiar() {
    nombreInput.value = "";
    cursoSelect.value = "";
    telefonoInput.value = "";
    emailInput.value = "";
    notasInput.value = "";
  }

  addBtn.addEventListener("click", () => {
    const datos = valores();
    if (!datos.nombre) return;
    onAdd(datos);
  });

  // Enter en cualquier campo añade, igual que pulsar el botón: es un
  // formulario de una línea que se rellena mientras hablas por teléfono.
  for (const campo of [nombreInput, telefonoInput, emailInput, notasInput]) {
    campo.addEventListener("keydown", (ev) => {
      if (ev.key !== "Enter") return;
      const datos = valores();
      if (!datos.nombre) return;
      onAdd(datos);
    });
  }

  return {
    el: form,
    valores,
    limpiar,
    setOcupado: (ocupado) => { addBtn.disabled = ocupado; },
    foco: () => nombreInput.focus(),
  };
}
