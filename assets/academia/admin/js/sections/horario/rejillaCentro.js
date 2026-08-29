import { filasDeRejillaDeConfig, tramosDe } from "../../../../../shared/js/horarioTramos.js";
import { nivelInfo } from "../../curso.js";
import { claveFranja, estadoFranja } from "../../drawer/horario/ocupacionCliente.js";

const NOMBRES_DIA = {
  1: "Lunes", 2: "Martes", 3: "Miércoles", 4: "Jueves",
  5: "Viernes", 6: "Sábado", 7: "Domingo",
};
const DIAS_POR_DEFECTO = [1, 2, 3, 4, 5];

// A diferencia de la rejilla del profesor (assets/academia/profesor/js/
// horario.js), esta NO lleva fechas ni navegación de semanas: el horario de
// una academia es un patrón semanal que se repite, y para planificar lo que
// importa es el patrón, no una semana concreta. Es más simple, no menos.
function diasDe(config) {
  const valores = Array.isArray(config.dias_laborables) && config.dias_laborables.length
    ? config.dias_laborables
    : DIAS_POR_DEFECTO;
  return [...valores].sort((a, b) => a - b);
}

function buildAlumnoChip(franja) {
  const chip = document.createElement("div");
  chip.className = "ach-alumno";
  const info = nivelInfo(franja.alumno?.nivel);
  chip.classList.add(`ach-lv-${info.cls}`);

  const nombre = document.createElement("span");
  nombre.className = "ach-alumno-nombre";
  nombre.textContent = franja.alumno?.nombre || "—";
  chip.appendChild(nombre);

  if (franja.alumno?.curso) {
    const curso = document.createElement("span");
    curso.className = "ach-alumno-curso";
    curso.textContent = franja.alumno.curso;
    chip.appendChild(curso);
  }
  return chip;
}

// `agrupacion`: clave por la que se separan las rejillas. Hoy siempre hay
// una sola ("todo el centro") porque academia_horario no guarda quién
// imparte cada franja y ningún centro tiene aún un segundo profesor. La
// forma está preparada para que, cuando eso cambie, se pase una rejilla por
// profesor sin reescribir nada de aquí.
export function buildRejillaCentro({ franjas = [], config = {}, titulo = null } = {}) {
  const dias = diasDe(config);
  // Medias horas, como la rejilla de asignación (ver horarioTramos.js): con
  // clases de duración libre, unas filas de una hora dejarían fuera todo lo
  // que empiece en punto cuando el centro abre y media, o al revés.
  const horas = filasDeRejillaDeConfig(config);
  const maxPorFranja = Number(config.max_alumnos_por_franja) || 0;

  // Una clase aparece en TODAS las medias horas que ocupa, no solo en la de
  // inicio: lo que se quiere ver de un vistazo es quién está en el aula a
  // cada hora. Además es lo que hace que el contador de plazas diga la
  // verdad cuando dos alumnos se solapan a medias (16:00-17:00 y
  // 16:30-17:30 comparten el aula media hora).
  const porClave = new Map();
  for (const f of franjas) {
    for (const tramo of tramosDe(f.hora_inicio, f.hora_fin)) {
      const clave = claveFranja(f.dia_semana, tramo);
      if (!porClave.has(clave)) porClave.set(clave, []);
      porClave.get(clave).push(f);
    }
  }

  const wrap = document.createElement("div");
  if (titulo) {
    const h = document.createElement("div");
    h.className = "ach-grupo-titulo";
    h.textContent = titulo;
    wrap.appendChild(h);
  }

  const grid = document.createElement("div");
  grid.className = "ach-grid";
  grid.style.gridTemplateColumns = `64px repeat(${dias.length}, minmax(140px, 1fr))`;

  grid.appendChild(document.createElement("div"));
  for (const dia of dias) {
    const head = document.createElement("div");
    head.className = "ach-head";
    head.textContent = NOMBRES_DIA[dia] || `Día ${dia}`;
    grid.appendChild(head);
  }

  for (const hora of horas) {
    const horaLabel = document.createElement("div");
    horaLabel.className = "ach-hora";
    horaLabel.textContent = hora;
    grid.appendChild(horaLabel);

    for (const dia of dias) {
      const enFranja = porClave.get(claveFranja(dia, hora)) || [];
      const cell = document.createElement("div");
      cell.className = "ach-cell";
      const estado = estadoFranja(enFranja.length, maxPorFranja);
      cell.classList.add(`ach-cell--${estado}`);

      if (!enFranja.length) {
        cell.classList.add("ach-cell--vacia");
      } else {
        const cabecera = document.createElement("div");
        cabecera.className = "ach-cell-conteo";
        cabecera.textContent = maxPorFranja
          ? `${enFranja.length}/${maxPorFranja}`
          : String(enFranja.length);
        cell.appendChild(cabecera);
        for (const f of enFranja) cell.appendChild(buildAlumnoChip(f));
      }
      grid.appendChild(cell);
    }
  }

  wrap.appendChild(grid);
  return wrap;
}
