import { buildIcon } from "../../icons.js";
import { buildInput, buildSelectCurso } from "./formulario.js";

// Una fila de la lista de espera, en sus dos estados: lectura y edición en
// línea. Antes no se podía editar, así que corregir un dígito de un
// teléfono obligaba a borrar el contacto y volver a escribirlo — y el
// borrado es definitivo. Es decir: el camino para arreglar una errata
// pasaba por destruir el dato.
//
// La fila no llama a la API: recibe `onGuardar`, `onEliminar` y
// `onMatricular` y devuelve lo que el usuario ha decidido. Así la sección
// controla recargas y mensajes en un único sitio.

const CAMPOS_TEXTO = [
  { clave: "telefono", etiqueta: "Teléfono" },
  { clave: "email", etiqueta: "Email", type: "email" },
  { clave: "notas", etiqueta: "Notas" },
];

function celda(texto) {
  const td = document.createElement("td");
  td.textContent = texto || "—";
  return td;
}

function botonIcono(icono, titulo, className, onClick) {
  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = className;
  btn.title = titulo;
  btn.setAttribute("aria-label", titulo);
  btn.appendChild(buildIcon(icono, { size: 14 }));
  btn.addEventListener("click", onClick);
  return btn;
}

// Estado de lectura. "Matricular" va el primero porque es lo que se hace
// con una lista de espera: cuando se libera una plaza, se llama y se da de
// alta. Los otros dos son mantenimiento.
function buildFilaLectura(entrada, { onEditar, onEliminar, onMatricular }) {
  const tr = document.createElement("tr");
  const acciones = document.createElement("td");
  acciones.className = "ac-le-acciones";
  acciones.append(
    // Mismo icono que "Alumnos" en el menú: matricular es, literalmente,
    // mover a esta persona de esta lista a aquella.
    botonIcono("users", "Matricular como alumno", "ac-icon-btn", () => onMatricular(entrada)),
    botonIcono("edit", "Editar", "ac-icon-btn", () => onEditar(entrada)),
    botonIcono("trash", "Eliminar", "ac-icon-btn danger", () => onEliminar(entrada))
  );
  tr.append(
    celda(entrada.nombre),
    celda(entrada.curso),
    celda(entrada.telefono),
    celda(entrada.email),
    celda(entrada.notas),
    acciones
  );
  return tr;
}

// Estado de edición. Solo se mandan al servidor los campos que han
// cambiado de verdad (ver `cambios()`): un PATCH con todo reescribiría
// datos que el admin ni ha tocado, y bastaría un fallo de pintado para
// borrar algo sin querer.
function buildFilaEdicion(entrada, { onGuardar, onCancelar }) {
  const tr = document.createElement("tr");

  const nombreInput = buildInput("Nombre", entrada.nombre);
  const cursoSelect = buildSelectCurso(entrada.curso);
  const inputs = { nombre: nombreInput, curso: cursoSelect };
  const celdas = [nombreInput, cursoSelect];
  for (const { clave, etiqueta, type } of CAMPOS_TEXTO) {
    const input = buildInput(etiqueta, entrada[clave], type ? { type } : {});
    inputs[clave] = input;
    celdas.push(input);
  }
  for (const campo of celdas) {
    const td = document.createElement("td");
    td.appendChild(campo);
    tr.appendChild(td);
  }

  function cambios() {
    const parche = {};
    for (const [clave, input] of Object.entries(inputs)) {
      const nuevo = input.value.trim();
      const anterior = String(entrada[clave] ?? "").trim();
      if (nuevo !== anterior) parche[clave] = nuevo;
    }
    return parche;
  }

  const acciones = document.createElement("td");
  acciones.className = "ac-le-acciones";
  const guardarBtn = botonIcono("check", "Guardar", "ac-icon-btn", () => {
    if (!nombreInput.value.trim()) {
      nombreInput.focus();
      return;
    }
    onGuardar(entrada, cambios(), { setOcupado });
  });
  const cancelarBtn = botonIcono("close", "Cancelar", "ac-icon-btn", () => onCancelar());
  acciones.append(guardarBtn, cancelarBtn);
  tr.appendChild(acciones);

  function setOcupado(ocupado) {
    guardarBtn.disabled = ocupado;
    cancelarBtn.disabled = ocupado;
    for (const input of Object.values(inputs)) input.disabled = ocupado;
  }

  // Enter guarda, Escape cancela — lo que ya espera cualquiera que edite
  // una tabla, y evita tener que apuntar al icono con el ratón.
  tr.addEventListener("keydown", (ev) => {
    if (ev.key === "Enter") {
      if (!nombreInput.value.trim()) return;
      onGuardar(entrada, cambios(), { setOcupado });
    } else if (ev.key === "Escape") {
      onCancelar();
    }
  });

  queueMicrotask(() => nombreInput.focus());
  return tr;
}

export function buildFila(entrada, { editando, onEditar, onCancelar, onGuardar, onEliminar, onMatricular }) {
  return editando
    ? buildFilaEdicion(entrada, { onGuardar, onCancelar })
    : buildFilaLectura(entrada, { onEditar, onEliminar, onMatricular });
}
