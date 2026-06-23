export const ASIGNATURAS_SUGERIDAS = ["Matemáticas", "Lengua", "Inglés", "Física y Química", "Biología", "Historia"];

function buildChips(nombreInput) {
  const chips = document.createElement("div");
  chips.className = "ac-chips";
  const buttons = ASIGNATURAS_SUGERIDAS.map((a) => {
    const chip = document.createElement("button");
    chip.type = "button";
    chip.className = "ac-chip";
    chip.textContent = a;
    chip.addEventListener("click", () => {
      nombreInput.value = a;
      refreshChips();
    });
    chips.appendChild(chip);
    return { label: a, el: chip };
  });
  function refreshChips() {
    for (const { label: a, el } of buttons) el.classList.toggle("on", nombreInput.value === a);
  }
  nombreInput.addEventListener("input", refreshChips);
  refreshChips();
  return chips;
}

// Construye un bloque "Asignatura + Tema trabajado". `posicion` es 1-based:
// 1 = asignatura principal (la que se guarda en el campo `asignatura` legacy
// para compatibilidad), 2/3 = asignaturas adicionales de la misma sesión.
export function buildAsignaturaBlock(posicion, { nombreInicial = "", temaInicial = "" } = {}) {
  const wrap = document.createElement("div");
  wrap.className = "ac-asignatura-block";

  const label = document.createElement("label");
  label.className = "ac-field-label";
  label.textContent = posicion === 1 ? "Asignatura" : `Asignatura ${posicion}`;
  wrap.appendChild(label);

  const nombreInput = document.createElement("input");
  nombreInput.type = "text";
  nombreInput.className = "ac-input";
  nombreInput.placeholder = "Elige una sugerida o escribe la tuya";
  nombreInput.value = nombreInicial;
  wrap.appendChild(buildChips(nombreInput));
  wrap.appendChild(nombreInput);

  const temaLabel = document.createElement("label");
  temaLabel.className = "ac-field-label ac-field-label-spaced";
  temaLabel.textContent = "Tema trabajado";
  wrap.appendChild(temaLabel);

  const temaInput = document.createElement("input");
  temaInput.type = "text";
  temaInput.className = "ac-input";
  temaInput.placeholder = "Ej. Ecuaciones de primer grado, ejercicios 4 a 9";
  temaInput.value = temaInicial;
  wrap.appendChild(temaInput);

  return {
    wrap,
    getValue: () => ({ nombre: nombreInput.value.trim(), tema: temaInput.value.trim() }),
    focusNombre: () => nombreInput.focus(),
  };
}
