import { toMinutos, toHHMM, generarHoras } from "../../../../shared/js/horarioFranjas.js";

const NOMBRES_DIA = { 1: "LU", 2: "MA", 3: "MI", 4: "JU", 5: "VI", 6: "SA" };
const DIAS_POR_DEFECTO = [1, 2, 3, 4, 5];

function formatHora(hora) {
  return String(hora || "").slice(0, 5);
}

function diasDesdeConfig(diasLaborables) {
  const valores = Array.isArray(diasLaborables) && diasLaborables.length ? diasLaborables : DIAS_POR_DEFECTO;
  return [...valores].sort((a, b) => a - b).map((value) => ({ value, label: NOMBRES_DIA[value] || `D${value}` }));
}

// `config`: {franja_inicio, franja_fin, franja_duracion, dias_laborables} de
// GET /academia/config. `horarioActual`: filas vigentes [{dia_semana,
// hora_inicio, hora_fin}] del alumno, para pre-marcar los checkboxes.
export function buildHorarioSection({ config = {}, horarioActual = [] } = {}) {
  const dias = diasDesdeConfig(config.dias_laborables);
  const horas = generarHoras(config.franja_inicio || "15:30", config.franja_fin || "20:30", config.franja_duracion || 60);
  const duracion = Number(config.franja_duracion) || 60;

  const marcadas = new Set(horarioActual.map((h) => `${h.dia_semana}|${formatHora(h.hora_inicio)}`));

  const wrap = document.createElement("div");
  const title = document.createElement("div");
  title.className = "ac-section-title";
  title.textContent = "HORARIO";
  wrap.appendChild(title);
  const spacer = document.createElement("div");
  spacer.style.height = "10px";
  wrap.appendChild(spacer);

  const grid = document.createElement("div");
  grid.className = "ac-horario-grid";
  grid.style.gridTemplateColumns = `56px repeat(${dias.length}, 1fr)`;
  grid.appendChild(document.createElement("div"));
  for (const dia of dias) {
    const head = document.createElement("div");
    head.className = "ac-horario-head";
    head.textContent = dia.label;
    grid.appendChild(head);
  }

  const checkboxes = [];
  for (const hora of horas) {
    const horaLabel = document.createElement("div");
    horaLabel.className = "ac-horario-hora";
    horaLabel.textContent = hora;
    grid.appendChild(horaLabel);

    for (const dia of dias) {
      const cell = document.createElement("div");
      cell.className = "ac-horario-cell";
      const checkbox = document.createElement("input");
      checkbox.type = "checkbox";
      checkbox.checked = marcadas.has(`${dia.value}|${hora}`);
      checkbox.dataset.diaSemana = String(dia.value);
      checkbox.dataset.horaInicio = hora;
      cell.classList.toggle("ac-horario-cell--selected", checkbox.checked);
      checkbox.addEventListener("change", () => {
        cell.classList.toggle("ac-horario-cell--selected", checkbox.checked);
      });
      cell.appendChild(checkbox);
      grid.appendChild(cell);
      checkboxes.push(checkbox);
    }
  }
  wrap.appendChild(grid);

  return {
    wrap,
    getValue: () =>
      checkboxes
        .filter((c) => c.checked)
        .map((c) => ({
          dia_semana: Number(c.dataset.diaSemana),
          hora_inicio: c.dataset.horaInicio,
          hora_fin: toHHMM(toMinutos(c.dataset.horaInicio) + duracion),
        })),
  };
}
