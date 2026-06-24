import { CURSOS, nivelDeCurso, nivelInfo } from "../curso.js";

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

// Sección "Datos del alumno": nombre, curso, fecha de alta, y un badge de
// nivel calculado en vivo a partir del curso (no es un campo editable).
export function buildDatosSection({ nombre = "", curso = "", fechaAlta = "" } = {}) {
  const wrap = document.createElement("div");

  const title = document.createElement("div");
  title.className = "ac-section-title";
  title.textContent = "DATOS DEL ALUMNO";
  wrap.appendChild(title);
  const spacer = document.createElement("div");
  spacer.style.height = "10px";
  wrap.appendChild(spacer);

  const nombreField = document.createElement("div");
  nombreField.className = "ac-field";
  const nombreLabel = document.createElement("label");
  nombreLabel.className = "ac-field-label";
  nombreLabel.textContent = "Nombre";
  const nombreInput = document.createElement("input");
  nombreInput.type = "text";
  nombreInput.className = "ac-input";
  nombreInput.value = nombre;
  nombreInput.placeholder = "Nombre del alumno";
  nombreField.append(nombreLabel, nombreInput);
  wrap.appendChild(nombreField);

  const cursoRow = document.createElement("div");
  cursoRow.className = "ac-field-row";

  const cursoField = document.createElement("div");
  cursoField.className = "ac-field";
  const cursoLabel = document.createElement("label");
  cursoLabel.className = "ac-field-label";
  cursoLabel.textContent = "Curso";
  const cursoSelect = document.createElement("select");
  cursoSelect.className = "ac-select";
  const blank = document.createElement("option");
  blank.value = "";
  blank.textContent = "Selecciona…";
  cursoSelect.appendChild(blank);
  for (const c of CURSOS) {
    const opt = document.createElement("option");
    opt.value = c;
    opt.textContent = c;
    cursoSelect.appendChild(opt);
  }
  cursoSelect.value = curso;
  cursoField.append(cursoLabel, cursoSelect);

  const nivelField = document.createElement("div");
  nivelField.className = "ac-field";
  const nivelLabel = document.createElement("label");
  nivelLabel.className = "ac-field-label";
  nivelLabel.textContent = "Nivel";
  const nivelBadgeWrap = document.createElement("div");
  nivelBadgeWrap.style.paddingTop = "8px";
  const nivelBadge = document.createElement("span");
  nivelBadgeWrap.appendChild(nivelBadge);
  nivelField.append(nivelLabel, nivelBadgeWrap);

  function refreshNivel() {
    const nivel = nivelDeCurso(cursoSelect.value);
    const info = nivelInfo(nivel);
    nivelBadge.className = `ac-lv ${info.cls}`;
    nivelBadge.textContent = nivel ? info.label : "—";
  }
  cursoSelect.addEventListener("change", refreshNivel);
  refreshNivel();

  cursoRow.append(cursoField, nivelField);
  wrap.appendChild(cursoRow);

  const fechaField = document.createElement("div");
  fechaField.className = "ac-field";
  const fechaLabel = document.createElement("label");
  fechaLabel.className = "ac-field-label";
  fechaLabel.textContent = "Fecha de alta";
  const fechaInput = document.createElement("input");
  fechaInput.type = "date";
  fechaInput.className = "ac-input";
  fechaInput.value = fechaAlta || todayISO();
  fechaField.append(fechaLabel, fechaInput);
  wrap.appendChild(fechaField);

  return {
    wrap,
    getValue: () => ({
      nombre: nombreInput.value.trim(),
      curso: cursoSelect.value,
      fecha_alta: fechaInput.value || todayISO(),
    }),
    // Aplica datos extraídos por OCR. Si el curso no coincide con ninguna
    // opción del select, se deja vacío y el campo se marca en ámbar para
    // que el admin lo complete a mano.
    setFromOcr({ nombre, curso } = {}) {
      if (nombre) nombreInput.value = nombre;
      cursoSelect.classList.remove("ac-input-amber");
      if (curso && CURSOS.includes(curso)) {
        cursoSelect.value = curso;
      } else if (curso) {
        cursoSelect.value = "";
        cursoSelect.classList.add("ac-input-amber");
      }
      refreshNivel();
    },
  };
}
