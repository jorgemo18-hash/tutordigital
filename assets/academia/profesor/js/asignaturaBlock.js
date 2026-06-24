export const ASIGNATURAS_SUGERIDAS = ["Matemáticas", "Lengua", "Inglés", "Física y Química", "Biología", "Historia"];
const OTRA = "Otra";

// Selector reutilizable de asignatura: chips fijos + chip "Otra" que revela
// un input de texto libre debajo. Lo usan tanto el bloque de asignatura de
// la sesión (buildAsignaturaBlock) como el bloque de nota de examen.
export function buildAsignaturaSelector({ valorInicial = "", onChange = null } = {}) {
  const wrap = document.createElement("div");

  let valorActual = valorInicial;
  let modo = !valorInicial ? null : ASIGNATURAS_SUGERIDAS.includes(valorInicial) ? "sugerida" : "otra";

  const chips = document.createElement("div");
  chips.className = "ac-chips";

  const input = document.createElement("input");
  input.type = "text";
  input.className = "ac-input hidden";
  input.placeholder = "Escribe la asignatura";
  input.value = modo === "otra" ? valorInicial : "";

  function refresh() {
    for (const { label, el } of botones) {
      el.classList.toggle("on", label === OTRA ? modo === "otra" : modo === "sugerida" && valorActual === label);
    }
    input.classList.toggle("hidden", modo !== "otra");
  }

  const botones = [...ASIGNATURAS_SUGERIDAS, OTRA].map((label) => {
    const chip = document.createElement("button");
    chip.type = "button";
    chip.className = "ac-chip";
    chip.textContent = label;
    chip.addEventListener("click", () => {
      if (label === OTRA) {
        modo = "otra";
        valorActual = input.value.trim();
        input.classList.remove("hidden");
        input.focus();
      } else {
        modo = "sugerida";
        valorActual = label;
      }
      refresh();
      onChange?.();
    });
    chips.appendChild(chip);
    return { label, el: chip };
  });

  input.addEventListener("input", () => {
    valorActual = input.value.trim();
    onChange?.();
  });

  wrap.append(chips, input);
  refresh();

  return { wrap, getValor: () => valorActual };
}

// Construye un bloque "Asignatura + Tema trabajado". `posicion` es 1-based:
// 1 = asignatura principal (la que se guarda en el campo `asignatura` legacy
// para compatibilidad, nunca tiene botón ×), 2/3 = asignaturas adicionales
// de la misma sesión (sí tienen botón × para quitarlas).
export function buildAsignaturaBlock(posicion, { nombreInicial = "", temaInicial = "", onRemove = null, onChange = null } = {}) {
  const wrap = document.createElement("div");
  wrap.className = "ac-asignatura-block";

  const labelRow = document.createElement("div");
  labelRow.className = "ac-asignatura-block-head";
  const label = document.createElement("label");
  label.className = "ac-field-label";
  label.textContent = posicion === 1 ? "Asignatura" : `Asignatura ${posicion}`;
  labelRow.appendChild(label);

  if (onRemove) {
    const removeBtn = document.createElement("button");
    removeBtn.type = "button";
    removeBtn.className = "ac-block-remove";
    removeBtn.setAttribute("aria-label", "Quitar asignatura");
    removeBtn.textContent = "×";
    removeBtn.addEventListener("click", onRemove);
    labelRow.appendChild(removeBtn);
  }
  wrap.appendChild(labelRow);

  const selector = buildAsignaturaSelector({ valorInicial: nombreInicial, onChange });
  wrap.appendChild(selector.wrap);

  const temaLabel = document.createElement("label");
  temaLabel.className = "ac-field-label ac-field-label-spaced";
  temaLabel.textContent = "Tema trabajado";
  wrap.appendChild(temaLabel);

  const temaInput = document.createElement("input");
  temaInput.type = "text";
  temaInput.className = "ac-input";
  temaInput.placeholder = "Ej. Ecuaciones de primer grado, ejercicios 4 a 9";
  temaInput.value = temaInicial;
  temaInput.addEventListener("input", () => onChange?.());
  wrap.appendChild(temaInput);

  return {
    wrap,
    getValue: () => ({ nombre: selector.getValor(), tema: temaInput.value.trim() }),
  };
}
