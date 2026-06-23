import { fetchHorario } from "./api.js";
import { buildIcon } from "./icons.js";
import { nivelInfo } from "./nivel.js";

const DIAS = [
  { value: 1, name: "Lunes" },
  { value: 2, name: "Martes" },
  { value: 3, name: "Miércoles" },
  { value: 4, name: "Jueves" },
  { value: 5, name: "Viernes" },
];
const MESES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];

function formatHora(hora) {
  return String(hora || "").slice(0, 5);
}

// Lunes (dia_semana=1) de la semana que contiene `referencia`.
function mondayOfWeek(referencia) {
  const day = referencia.getDay(); // 0=domingo…6=sábado
  const offset = day === 0 ? -6 : 1 - day;
  const monday = new Date(referencia);
  monday.setDate(referencia.getDate() + offset);
  return monday;
}

function weekDateLabels(monday) {
  const labels = {};
  for (const dia of DIAS) {
    const date = new Date(monday);
    date.setDate(monday.getDate() + (dia.value - 1));
    labels[dia.value] = `${date.getDate()} ${MESES[date.getMonth()]}`;
  }
  return labels;
}

// Agrupa las franjas por hora (filas) y por día (columnas). Las horas se
// derivan de los datos reales en vez de una lista fija, porque cada centro
// configura su propia franja_duracion/franja_inicio en academia_config.
export function groupFranjasPorHoraYDia(franjas) {
  const horas = [...new Set((franjas || []).map((f) => formatHora(f.hora_inicio)))].sort();
  const celdas = new Map();
  for (const franja of franjas || []) {
    const key = `${franja.dia_semana}|${formatHora(franja.hora_inicio)}`;
    if (!celdas.has(key)) celdas.set(key, []);
    celdas.get(key).push(franja);
  }
  return { horas, celdas };
}

function buildSlot(franja) {
  const lv = nivelInfo(franja.alumno?.nivel);
  const slot = document.createElement("div");
  slot.className = "ac-slot";
  slot.style.setProperty("--lvc", lv.color);

  const name = document.createElement("span");
  name.className = "ac-slot-name";
  name.textContent = franja.alumno?.nombre || "(sin nombre)";
  slot.appendChild(name);

  const foot = document.createElement("div");
  foot.className = "ac-slot-foot";
  const course = document.createElement("span");
  course.className = "ac-slot-course";
  course.textContent = franja.alumno?.curso || "";
  foot.appendChild(course);
  const lvTag = document.createElement("span");
  lvTag.className = `ac-lv ${lv.cls}`;
  lvTag.textContent = lv.label;
  foot.appendChild(lvTag);
  slot.appendChild(foot);

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

export function buildHorarioGrid(franjas) {
  const { horas, celdas } = groupFranjasPorHoraYDia(franjas);
  const fechas = weekDateLabels(mondayOfWeek(new Date()));

  if (horas.length === 0) {
    const empty = document.createElement("p");
    empty.className = "ac-empty";
    empty.textContent = "No tienes ninguna franja asignada en el horario.";
    return empty;
  }

  const grid = document.createElement("div");
  grid.className = "ac-grid";

  const corner = document.createElement("div");
  corner.className = "ac-corner";
  corner.textContent = "Hora";
  grid.appendChild(corner);

  for (const dia of DIAS) {
    const head = document.createElement("div");
    head.className = "ac-grid-head";
    const name = document.createElement("span");
    name.className = "ac-day-name";
    name.textContent = dia.name;
    const date = document.createElement("span");
    date.className = "ac-day-date";
    date.textContent = fechas[dia.value];
    const count = document.createElement("span");
    count.className = "ac-day-count";
    const n = countAlumnosPorDia(franjas, dia.value);
    count.textContent = `${n} ${n === 1 ? "alumno" : "alumnos"}`;
    head.append(name, date, count);
    grid.appendChild(head);
  }

  for (const hora of horas) {
    const time = document.createElement("div");
    time.className = "ac-time";
    time.textContent = hora;
    grid.appendChild(time);

    for (const dia of DIAS) {
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
  const note = document.createElement("span");
  note.className = "ac-readonly-note";
  note.append(buildIcon("lock", { size: 12 }), document.createTextNode("Consulta"));
  legend.appendChild(note);
  head.appendChild(legend);

  return head;
}

export async function renderHorario(container, { fetchHorarioFn = fetchHorario } = {}) {
  if (!container) return;
  container.innerHTML = '<p class="ac-loading">Cargando horario…</p>';
  try {
    const franjas = await fetchHorarioFn();
    container.innerHTML = "";
    container.appendChild(buildBodyHead());
    container.appendChild(buildHorarioGrid(franjas));
  } catch (err) {
    container.innerHTML = `<p class="ac-error">${err.message || "Error al cargar el horario."}</p>`;
  }
}
