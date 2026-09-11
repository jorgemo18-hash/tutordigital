import {
  bloquesDeConfig,
  etiquetaFranja,
  repartirEnBloques,
} from "../../../../../shared/js/horarioBloques.js";
import { hoyYMD, textoDesde, tituloDesde } from "../../../../../shared/js/desdeFecha.js";
import { nivelInfo } from "../../curso.js";
import { estadoFranja } from "../../drawer/horario/ocupacionCliente.js";

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

function buildAlumnoChip(franja, hoyISO) {
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

  // "desde 6/10" para el que tiene la plaza pero aún no viene.
  //
  // ESTA ES LA PANTALLA DONDE HACE FALTA (Jorge, 11/09: *"dijimos de no
  // tocarlo en horario —a lo mejor que salgan entre paréntesis o marcados
  // de alguna manera— pero que no salgan en diario"*). El cuadrante del
  // centro es donde se decide si cabe alguien más en un hueco, y hasta hoy
  // un alumno de octubre se veía idéntico a uno que ya viene: la plaza
  // cuenta —está comprometida, y por eso sale— pero quién esté hoy en el
  // aula es otra cosa. El cuadrante del profesor ya lo marcaba; este no.
  const desde = textoDesde(franja.fecha_inicio, hoyISO);
  if (desde) {
    chip.classList.add("ach-alumno--futuro");
    const tag = document.createElement("span");
    tag.className = "ach-alumno-desde";
    tag.textContent = desde;
    tag.title = tituloDesde(franja.fecha_inicio);
    chip.appendChild(tag);
  }
  return chip;
}

// La cajita de la esquina de una fila: los que vienen a otra hora (de en
// punto a en punto cuando el centro va de y media a y media). Llevan la
// hora delante, que es lo único que los distingue de los de la fila.
function buildSueltas(sueltas, hoyISO) {
  const box = document.createElement("div");
  box.className = "ach-sueltas";
  for (const franja of sueltas) {
    const item = buildAlumnoChip(franja, hoyISO);
    item.classList.add("ach-alumno--suelto");
    const hora = document.createElement("span");
    hora.className = "ach-suelta-hora";
    hora.textContent = etiquetaFranja(franja);
    item.insertBefore(hora, item.firstChild);
    box.appendChild(item);
  }
  return box;
}

// `agrupacion`: clave por la que se separan las rejillas. Hoy siempre hay
// una sola ("todo el centro") porque academia_horario no guarda quién
// imparte cada franja y ningún centro tiene aún un segundo profesor. La
// forma está preparada para que, cuando eso cambie, se pase una rejilla por
// profesor sin reescribir nada de aquí.
export function buildRejillaCentro({ franjas = [], config = {}, titulo = null, hoyISO = hoyYMD() } = {}) {
  const dias = diasDe(config);
  // Una fila por CLASE del centro, no por media hora (ver
  // horarioBloques.js): con medias horas, cada alumno de una clase de una
  // hora salía en dos filas y el cuadrante parecía el doble de lleno. Lo
  // que no cubre una fila entera —de en punto a en punto— va a la cajita de
  // su fila, con la hora escrita.
  const bloques = bloquesDeConfig(config);
  const maxPorFranja = Number(config.max_alumnos_por_franja) || 0;

  // El reparto se hace por día: cada columna tiene sus propias clases.
  const reparto = new Map(
    dias.map((dia) => [dia, repartirEnBloques(franjas.filter((f) => f.dia_semana === dia), bloques)])
  );

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

  bloques.forEach((bloque, fila) => {
    const horaLabel = document.createElement("div");
    horaLabel.className = "ach-hora";
    const desde = document.createElement("span");
    desde.className = "ach-hora-desde";
    desde.textContent = bloque.inicio;
    const hasta = document.createElement("span");
    hasta.className = "ach-hora-hasta";
    hasta.textContent = bloque.fin;
    horaLabel.append(desde, hasta);
    grid.appendChild(horaLabel);

    for (const dia of dias) {
      const { dentro = [], sueltas = [], ocupacion = 0 } = reparto.get(dia)?.[fila] || {};
      const cell = document.createElement("div");
      cell.className = "ach-cell";
      // La ocupación es "cuántos hay A LA VEZ" dentro de la fila, no
      // cuántas clases la tocan: dos clases de media hora seguidas no
      // llenan el aula, y contarlas juntas daría un 6/6 falso.
      cell.classList.add(`ach-cell--${estadoFranja(ocupacion, maxPorFranja)}`);

      if (!dentro.length && !sueltas.length) {
        cell.classList.add("ach-cell--vacia");
      } else {
        const cabecera = document.createElement("div");
        cabecera.className = "ach-cell-conteo";
        cabecera.textContent = maxPorFranja ? `${ocupacion}/${maxPorFranja}` : String(ocupacion);
        cell.appendChild(cabecera);
        for (const f of dentro) cell.appendChild(buildAlumnoChip(f, hoyISO));
        if (sueltas.length) cell.appendChild(buildSueltas(sueltas, hoyISO));
      }
      grid.appendChild(cell);
    }
  });

  wrap.appendChild(grid);
  return wrap;
}
