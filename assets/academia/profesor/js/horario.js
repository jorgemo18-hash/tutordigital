import { fetchHorario, fetchConfig, fetchMisSustituciones } from "./api.js";
import { nivelInfo } from "./nivel.js";
import { buildAvisoSustituciones } from "./sustitucionesAviso.js";
import { buildBadgeSustitucion } from "./sustitucionBadge.js";
import { escHtml } from "../../../shared/js/escHtml.js";
import { generarHoras } from "../../../shared/js/horarioFranjas.js";

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

export function groupFranjasEnCeldas(franjas) {
  const celdas = new Map();
  for (const franja of franjas || []) {
    const key = `${franja.dia_semana}|${formatHora(franja.hora_inicio)}`;
    if (!celdas.has(key)) celdas.set(key, []);
    celdas.get(key).push(franja);
  }
  return celdas;
}

function buildSlot(franja) {
  const lv = nivelInfo(franja.alumno?.nivel);
  const slot = document.createElement("div");
  slot.className = "ac-slot";
  slot.style.setProperty("--lvc", lv.color);

  const line = document.createElement("div");
  line.className = "ac-slot-line";
  const name = document.createElement("span");
  name.className = "ac-slot-name";
  name.textContent = franja.alumno?.nombre || "(sin nombre)";
  const course = document.createElement("span");
  course.className = "ac-slot-course";
  course.textContent = franja.alumno?.curso ? `· ${franja.alumno.curso}` : "";
  line.append(name, course);
  slot.appendChild(line);

  // .ac-slot-meta agrupa nivel + sustitución a la derecha: .ac-slot solo
  // tiene 2 hijos (nombre a la izquierda, este grupo a la derecha) para
  // que justify-content:space-between siga separando exactamente esos
  // dos bloques en vez de repartir 3 huecos si el badge colgara suelto.
  const meta = document.createElement("div");
  meta.className = "ac-slot-meta";
  const lvTag = document.createElement("span");
  lvTag.className = `ac-lv ${lv.cls}`;
  lvTag.textContent = lv.label;
  meta.appendChild(lvTag);

  const badge = buildBadgeSustitucion(franja.via_sustitucion);
  if (badge) meta.appendChild(badge);
  slot.appendChild(meta);

  return slot;
}

function buildCell(franjasDelSlot) {
  const cell = document.createElement("div");
  if (!franjasDelSlot.length) {
    cell.className = "ac-cell empty";
    return cell;
  }
  cell.className = "ac-cell filled";
  if (franjasDelSlot.length > 1) {
    const tag = document.createElement("span");
    tag.className = "ac-group-tag";
    tag.textContent = `Grupo · ${franjasDelSlot.length}`;
    cell.appendChild(tag);
  }
  for (const franja of franjasDelSlot) cell.appendChild(buildSlot(franja));
  return cell;
}

function countAlumnosPorDia(franjas, diaValue) {
  const ids = new Set(franjas.filter((f) => f.dia_semana === diaValue).map((f) => f.alumno?.id));
  return ids.size;
}

export function buildHorarioGrid(franjas, dias, horas) {
  if (horas.length === 0) {
    const empty = document.createElement("p");
    empty.className = "ac-empty";
    empty.textContent = "No hay franjas configuradas para este horario.";
    return empty;
  }

  const celdas = groupFranjasEnCeldas(franjas);
  const fechas = weekDateLabels(mondayOfWeek(new Date()), dias);

  const grid = document.createElement("div");
  grid.className = "ac-grid";
  grid.style.gridTemplateColumns = `72px repeat(${dias.length}, 1fr)`;

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

  for (const hora of horas) {
    const time = document.createElement("div");
    time.className = "ac-time";
    time.textContent = hora;
    grid.appendChild(time);

    for (const dia of dias) {
      const franjasDelSlot = celdas.get(`${dia.value}|${hora}`) || [];
      grid.appendChild(buildCell(franjasDelSlot));
    }
  }

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
// y a las horas que aparezcan en los datos reales.
function horasDeRespaldo(franjas) {
  return [...new Set((franjas || []).map((f) => formatHora(f.hora_inicio)))].sort();
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
    const horas = config
      ? generarHoras(config.franja_inicio, config.franja_fin, config.franja_duracion)
      : horasDeRespaldo(franjas);
    container.appendChild(buildHorarioGrid(franjas, dias, horas));
  } catch (err) {
    container.innerHTML = `<p class="ac-error">${escHtml(err.message || "Error al cargar el horario.")}</p>`;
  }
}
