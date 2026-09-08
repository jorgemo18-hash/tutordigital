import { fetchHorario, fetchConfig, fetchMisSustituciones } from "./api.js";
import { buildAvisoSustituciones } from "./sustitucionesAviso.js";
import { buildCell } from "./horarioCelda.js";
import { escHtml } from "../../../shared/js/escHtml.js";
import { bloquesDeConfig, repartirEnBloques } from "../../../shared/js/horarioBloques.js";

const NOMBRES_DIA = { 1: "Lunes", 2: "Martes", 3: "Miércoles", 4: "Jueves", 5: "Viernes", 6: "Sábado", 7: "Domingo" };
const DIAS_POR_DEFECTO = [1, 2, 3, 4, 5];
const MESES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];

function formatHora(hora) {
  return String(hora || "").slice(0, 5);
}

// Columnas del grid según dias_laborables (por defecto lunes-viernes; incluye
// sábado si el centro lo configura).
export function diasDesdeConfig(diasLaborables) {
  const valores = Array.isArray(diasLaborables) && diasLaborables.length ? diasLaborables : DIAS_POR_DEFECTO;
  return [...valores].sort((a, b) => a - b).map((value) => ({ value, name: NOMBRES_DIA[value] || `Día ${value}` }));
}

// Lunes (dia_semana=1) de la semana que contiene `referencia`.
function mondayOfWeek(referencia) {
  const day = referencia.getDay(); // 0=domingo…6=sábado
  const offset = day === 0 ? -6 : 1 - day;
  const monday = new Date(referencia);
  monday.setDate(referencia.getDate() + offset);
  return monday;
}

function weekDateLabels(monday, dias) {
  const labels = {};
  for (const dia of dias) {
    const date = new Date(monday);
    date.setDate(monday.getDate() + (dia.value - 1));
    labels[dia.value] = `${date.getDate()} ${MESES[date.getMonth()]}`;
  }
  return labels;
}

// Una fila por CLASE, no por media hora (ver horarioBloques.js): con filas
// de media hora, una clase de una hora sale dos veces y el horario parece
// el doble de lleno de lo que está. Lo que no cubre una fila entera —de en
// punto a en punto— va a la cajita de la esquina, con su hora.
export function repartoPorDia(franjas, dias, bloques) {
  const porDia = new Map();
  for (const dia of dias) {
    const delDia = (franjas || []).filter((f) => f.dia_semana === dia.value);
    porDia.set(dia.value, repartirEnBloques(delDia, bloques));
  }
  return porDia;
}

function countAlumnosPorDia(franjas, diaValue) {
  const ids = new Set(franjas.filter((f) => f.dia_semana === diaValue).map((f) => f.alumno?.id));
  return ids.size;
}

// ¿Hay alguien que solo ocupe media hora del hueco? Decide si se pinta la
// leyenda del asterisco: una nota fija que no aplica a nadie es ruido.
export function hayMediaHora(franjas, dias, bloques) {
  const reparto = repartoPorDia(franjas, dias, bloques);
  for (const filas of reparto.values()) {
    if (filas.some((fila) => fila.sueltas.length)) return true;
  }
  return false;
}

// `bloques`: [{inicio, fin}] — una fila por clase (ver horarioBloques.js).
// `maxPorFranja`: plazas del centro (academia_config.max_alumnos_por_franja).
export function buildHorarioGrid(franjas, dias, bloques, maxPorFranja = 0) {
  if (bloques.length === 0) {
    const empty = document.createElement("p");
    empty.className = "ac-empty";
    empty.textContent = "No hay franjas configuradas para este horario.";
    return empty;
  }

  const reparto = repartoPorDia(franjas, dias, bloques);
  const fechas = weekDateLabels(mondayOfWeek(new Date()), dias);

  const grid = document.createElement("div");
  grid.className = "ac-grid";
  // minmax(0, 1fr) y no 1fr: `1fr` es `minmax(auto, 1fr)`, y ese `auto`
  // impide que una columna baje de lo que mide su contenido. Con el menú
  // lateral del panel de admin quitando ~200px ("Dar clase"), los cinco
  // días no cabían y el viernes se salía de la pantalla. Con minmax(0,…)
  // las columnas se reparten el ancho que haya y los nombres largos se
  // cortan con puntos suspensivos, que ya estaba previsto en el CSS.
  grid.style.gridTemplateColumns = `76px repeat(${dias.length}, minmax(0, 1fr))`;

  const corner = document.createElement("div");
  corner.className = "ac-corner";
  corner.textContent = "Hora";
  grid.appendChild(corner);

  for (const dia of dias) {
    const head = document.createElement("div");
    head.className = "ac-grid-head";
    const nameRow = document.createElement("div");
    nameRow.className = "ac-day-namerow";
    const name = document.createElement("span");
    name.className = "ac-day-name";
    name.textContent = dia.name;
    const date = document.createElement("span");
    date.className = "ac-day-date";
    date.textContent = fechas[dia.value];
    nameRow.append(name, date);
    const count = document.createElement("span");
    count.className = "ac-day-count";
    const n = countAlumnosPorDia(franjas, dia.value);
    count.textContent = `${n} ${n === 1 ? "alumno" : "alumnos"}`;
    head.append(nameRow, count);
    grid.appendChild(head);
  }

  bloques.forEach((bloque, fila) => {
    // Las dos horas, una debajo de otra: con solo la de inicio, y filas que
    // empiezan y media, hay que reconstruir de cabeza dónde acaba cada
    // clase — que es justo lo que se veía mal.
    const time = document.createElement("div");
    time.className = "ac-time";
    const desde = document.createElement("span");
    desde.className = "ac-time-desde";
    desde.textContent = bloque.inicio;
    const hasta = document.createElement("span");
    hasta.className = "ac-time-hasta";
    hasta.textContent = bloque.fin;
    time.append(desde, hasta);
    grid.appendChild(time);

    for (const dia of dias) {
      grid.appendChild(buildCell(reparto.get(dia.value)?.[fila], maxPorFranja));
    }
  });

  return grid;
}

function buildBodyHead() {
  const head = document.createElement("div");
  head.className = "ac-body-head";

  const titleBox = document.createElement("div");
  const title = document.createElement("h1");
  title.className = "ac-title";
  title.innerHTML = 'Horario <em>semanal</em>';
  const sub = document.createElement("div");
  sub.className = "ac-sub";
  sub.textContent = "Semana actual · Solo lectura";
  titleBox.append(title, sub);
  head.appendChild(titleBox);

  const legend = document.createElement("div");
  legend.className = "ac-legend";
  const items = [
    ["lv-pri-bg", "Primaria"],
    ["lv-eso-bg", "ESO"],
    ["lv-bach-bg", "Bachillerato"],
  ];
  for (const [dotClass, label] of items) {
    const item = document.createElement("span");
    item.className = "ac-legend-item";
    const dot = document.createElement("span");
    dot.className = `ac-legend-dot ${dotClass}`;
    item.append(dot, document.createTextNode(label));
    legend.appendChild(item);
  }
  head.appendChild(legend);

  return head;
}

// Si /academia/config falla, no bloqueamos el horario: se cae a lunes-viernes
// y a las filas que aparezcan en los datos reales — cada pareja
// inicio/fin distinta es una fila, que sin la configuración del centro es
// lo más parecido a "las clases que hay".
function bloquesDeRespaldo(franjas) {
  const vistos = new Map();
  for (const f of franjas || []) {
    const inicio = formatHora(f.hora_inicio);
    const fin = formatHora(f.hora_fin) || inicio;
    vistos.set(`${inicio}|${fin}`, { inicio, fin });
  }
  return [...vistos.values()].sort((a, b) => a.inicio.localeCompare(b.inicio) || a.fin.localeCompare(b.fin));
}

// Mensaje explícito en vez de una rejilla vacía sin explicación: un
// profesor recién invitado (o al que aún no se le ha asignado ningún
// alumno, ver academia_profesor_alumnos) recibe franjas: [] del backend
// — sin este aviso, el horario se veía como una rejilla en blanco, sin
// pista de por qué ("¿está roto?").
// Texto por defecto, el del profesor. El panel de admin ("Dar clase") pasa
// el suyo: ahí quien lee ES el administrador, y decirle que se lo pida al
// administrador sería absurdo.
const MENSAJE_SIN_ALUMNOS =
  "No tienes alumnos asignados. Pide al administrador que te asigne alumnos para ver tu horario.";

export async function renderHorario(container, {
  fetchHorarioFn = fetchHorario, fetchConfigFn = fetchConfig, fetchMisSustitucionesFn = fetchMisSustituciones,
  mensajeSinAlumnos = MENSAJE_SIN_ALUMNOS,
} = {}) {
  if (!container) return;
  container.innerHTML = '<p class="ac-loading">Cargando horario…</p>';
  try {
    const [{ franjas, sinAlumnosAsignados }, config, sustituciones] = await Promise.all([
      fetchHorarioFn(),
      fetchConfigFn().catch(() => null),
      fetchMisSustitucionesFn().catch(() => []),
    ]);

    container.innerHTML = "";
    container.appendChild(buildBodyHead());

    const aviso = buildAvisoSustituciones(sustituciones);
    if (aviso) container.appendChild(aviso);

    // Distinto de "esta semana no hay franjas" (buildHorarioGrid ya cubre
    // ese caso con horas.length===0): esto es "no tienes NINGÚN alumno
    // asignado todavía" — el backend lo distingue explícitamente (ver
    // academia.horario.routes.js) para no mostrar un mensaje equivocado.
    if (sinAlumnosAsignados) {
      const empty = document.createElement("p");
      empty.className = "ac-empty";
      empty.textContent = mensajeSinAlumnos;
      container.appendChild(empty);
      return;
    }

    const dias = diasDesdeConfig(config?.dias_laborables);
    const bloques = config ? bloquesDeConfig(config) : bloquesDeRespaldo(franjas);
    container.appendChild(
      buildHorarioGrid(franjas, dias, bloques, Number(config?.max_alumnos_por_franja) || 0)
    );
    if (hayMediaHora(franjas, dias, bloques)) {
      const nota = document.createElement("p");
      nota.className = "ac-grid-nota";
      // Antes decía "Hay alumnos que solo ocupan media hora del hueco",
      // que con el conteo viejo era un aviso de gente SIN CONTAR. Ahora
      // está contada (ver buildCell en horarioCelda.js) y lo que hay que
      // explicar es otra cosa: por qué un 6/6 puede convivir con una
      // columna donde a ratos se ven cuatro nombres.
      nota.textContent = "* En estos huecos no están todos a la vez: el número es el momento de más gente.";
      container.appendChild(nota);
    }
  } catch (err) {
    container.innerHTML = `<p class="ac-error">${escHtml(err.message || "Error al cargar el horario.")}</p>`;
  }
}
