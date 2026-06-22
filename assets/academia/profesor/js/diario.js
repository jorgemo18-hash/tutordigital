import { fetchDiario } from "./api.js";
import { buildSessionCard } from "./sessionCard.js";

const DIA_MS = 24 * 60 * 60 * 1000;
const RANGO_DIAS_ATRAS = 30;

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

function shiftISO(fechaISO, days) {
  const [y, m, d] = fechaISO.split("-").map(Number);
  const date = new Date(Date.UTC(y, m - 1, d) + days * DIA_MS);
  return date.toISOString().slice(0, 10);
}

function clampToRange(fechaISO) {
  const max = todayISO();
  const min = shiftISO(max, -RANGO_DIAS_ATRAS);
  if (fechaISO > max) return max;
  if (fechaISO < min) return min;
  return fechaISO;
}

function buildDateNav(fechaActual, onChange) {
  const nav = document.createElement("div");
  nav.className = "diarioNav";

  const prevBtn = document.createElement("button");
  prevBtn.type = "button";
  prevBtn.textContent = "←";
  prevBtn.addEventListener("click", () => onChange(clampToRange(shiftISO(fechaActual, -1))));
  nav.appendChild(prevBtn);

  const dateInput = document.createElement("input");
  dateInput.type = "date";
  dateInput.value = fechaActual;
  dateInput.max = todayISO();
  dateInput.min = shiftISO(todayISO(), -RANGO_DIAS_ATRAS);
  dateInput.addEventListener("change", () => {
    if (dateInput.value) onChange(clampToRange(dateInput.value));
  });
  nav.appendChild(dateInput);

  const nextBtn = document.createElement("button");
  nextBtn.type = "button";
  nextBtn.textContent = "→";
  nextBtn.disabled = fechaActual >= todayISO();
  nextBtn.addEventListener("click", () => onChange(clampToRange(shiftISO(fechaActual, 1))));
  nav.appendChild(nextBtn);

  return nav;
}

function buildAlumnosList(alumnos, fecha) {
  const list = document.createElement("div");
  list.className = "diarioList";
  if (!alumnos.length) {
    const empty = document.createElement("p");
    empty.className = "academiaEmpty";
    empty.textContent = "Sin alumnos con clase este día.";
    list.appendChild(empty);
    return list;
  }
  for (const entry of alumnos) {
    list.appendChild(buildSessionCard(entry, fecha));
  }
  return list;
}

export async function renderDiario(container, { fetchDiarioFn = fetchDiario, fechaInicial } = {}) {
  if (!container) return;
  let fecha = clampToRange(fechaInicial || todayISO());

  async function load() {
    container.innerHTML = "";
    container.appendChild(buildDateNav(fecha, (nuevaFecha) => {
      fecha = nuevaFecha;
      load();
    }));

    const listContainer = document.createElement("div");
    listContainer.className = "academiaLoading";
    listContainer.textContent = "Cargando diario…";
    container.appendChild(listContainer);

    try {
      const { alumnos } = await fetchDiarioFn(fecha);
      listContainer.replaceWith(buildAlumnosList(alumnos || [], fecha));
    } catch (err) {
      listContainer.className = "academiaError";
      listContainer.textContent = err.message || "Error al cargar el diario.";
    }
  }

  await load();
}
