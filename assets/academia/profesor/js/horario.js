import { fetchHorario } from "./api.js";

const DIAS = [
  { value: 1, label: "Lunes" },
  { value: 2, label: "Martes" },
  { value: 3, label: "Miércoles" },
  { value: 4, label: "Jueves" },
  { value: 5, label: "Viernes" },
];

function formatHora(hora) {
  return String(hora || "").slice(0, 5);
}

function buildAlumnoChip(franja) {
  const chip = document.createElement("div");
  chip.className = "horarioChip";

  const hora = document.createElement("span");
  hora.className = "horarioChipHora";
  hora.textContent = `${formatHora(franja.hora_inicio)}–${formatHora(franja.hora_fin)}`;
  chip.appendChild(hora);

  const nombre = document.createElement("span");
  nombre.className = "horarioChipNombre";
  nombre.textContent = franja.alumno?.nombre || "(sin nombre)";
  chip.appendChild(nombre);

  if (franja.alumno?.curso) {
    const curso = document.createElement("span");
    curso.className = "horarioChipCurso";
    curso.textContent = franja.alumno.curso;
    chip.appendChild(curso);
  }

  return chip;
}

export function buildHorarioGrid(franjas) {
  const grid = document.createElement("div");
  grid.className = "horarioGrid";

  for (const dia of DIAS) {
    const column = document.createElement("div");
    column.className = "horarioColumn";

    const heading = document.createElement("h3");
    heading.textContent = dia.label;
    column.appendChild(heading);

    const delDia = franjas
      .filter((f) => f.dia_semana === dia.value)
      .sort((a, b) => formatHora(a.hora_inicio).localeCompare(formatHora(b.hora_inicio)));

    if (delDia.length === 0) {
      const empty = document.createElement("p");
      empty.className = "horarioEmpty";
      empty.textContent = "Sin clases";
      column.appendChild(empty);
    } else {
      for (const franja of delDia) {
        column.appendChild(buildAlumnoChip(franja));
      }
    }

    grid.appendChild(column);
  }

  return grid;
}

export async function renderHorario(container, { fetchHorarioFn = fetchHorario } = {}) {
  if (!container) return;
  container.innerHTML = '<p class="academiaLoading">Cargando horario…</p>';
  try {
    const franjas = await fetchHorarioFn();
    container.innerHTML = "";
    container.appendChild(buildHorarioGrid(franjas));
  } catch (err) {
    container.innerHTML = `<p class="academiaError">${err.message || "Error al cargar el horario."}</p>`;
  }
}
