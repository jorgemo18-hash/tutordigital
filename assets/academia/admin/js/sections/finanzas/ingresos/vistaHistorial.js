import { fetchGridIngresos } from "../../../apiFinanzas.js";
import { MESES } from "../calculos.js";
import { buildTickCheckbox } from "./tickCheckbox.js";

function anioActual() {
  return new Date().getFullYear();
}

// Envuelve título+tabla en una tarjeta — sin esto el contenido queda
// directamente sobre la foto de fondo del panel.
function buildPanelBlock(hijos) {
  const panel = document.createElement("div");
  panel.className = "ac-panel";
  panel.append(...hijos);
  return panel;
}

function buildSelectAnio(anioSeleccionado) {
  const select = document.createElement("select");
  select.className = "ac-select";
  select.style.width = "100px";
  for (let a = 2024; a <= anioActual() + 2; a += 1) {
    const opt = document.createElement("option");
    opt.value = String(a);
    opt.textContent = String(a);
    opt.selected = a === anioSeleccionado;
    select.appendChild(opt);
  }
  return select;
}

// Celda gris (sin recibo) vs. checkbox clicable (con recibo) — el tick
// reutiliza la misma lógica de marcar-pagado/pendiente que "Pendientes".
function buildCeldaMes(celda, onCambiado) {
  const td = document.createElement("td");
  td.appendChild(buildTickCheckbox({ reciboId: celda.recibo_id, estado: celda.estado, onCambiado }));
  return td;
}

function buildGridTable(filas, onCambiado) {
  const wrap = document.createElement("div");
  wrap.className = "ac-table-wrap";
  const table = document.createElement("table");
  table.className = "ac-table";

  const thead = document.createElement("thead");
  const trHead = document.createElement("tr");
  trHead.innerHTML = "<th>Familia</th><th>Alumno</th><th>Cuota</th>";
  for (const c of filas[0]?.meses || []) {
    const th = document.createElement("th");
    th.textContent = MESES[c.mes - 1];
    trHead.appendChild(th);
  }
  thead.appendChild(trHead);
  table.appendChild(thead);

  const tbody = document.createElement("tbody");
  for (const fila of filas) {
    const tr = document.createElement("tr");
    const tdFamilia = document.createElement("td");
    tdFamilia.textContent = fila.familia_nombre;
    const tdAlumno = document.createElement("td");
    tdAlumno.textContent = fila.nombre_alumno;
    const tdCuota = document.createElement("td");
    tdCuota.textContent = `${fila.cuota.toFixed(2)} €`;
    tr.append(tdFamilia, tdAlumno, tdCuota);
    for (const celda of fila.meses) tr.appendChild(buildCeldaMes(celda, onCambiado));
    tbody.appendChild(tr);
  }
  table.appendChild(tbody);
  wrap.appendChild(table);
  return wrap;
}

// Vista "Historial" de Ingresos — grid anual por alumno (curso académico
// sep-ago que contiene el año seleccionado: elegir "2026" muestra
// sep/2025-ago/2026, el curso en el que cae ese año natural). Reutiliza
// /ingresos/grid pasando junio (cualquier mes de ene-ago) del año
// seleccionado — ya filtra por curso académico en el backend.
export function renderVistaHistorial(container) {
  let anio = anioActual();

  async function cargar() {
    container.innerHTML = "";
    const cargando = document.createElement("p");
    cargando.className = "ac-loading";
    cargando.textContent = "Cargando…";
    container.appendChild(cargando);

    let filas;
    try {
      filas = await fetchGridIngresos({ mes: 6, anio });
    } catch (err) {
      container.innerHTML = "";
      const p = document.createElement("p");
      p.className = "ac-error";
      p.textContent = err.message || "No se pudo cargar el historial.";
      container.appendChild(p);
      return;
    }

    container.innerHTML = "";
    const selectorWrap = document.createElement("div");
    selectorWrap.style.marginBottom = "18px";
    const selectAnio = buildSelectAnio(anio);
    selectAnio.addEventListener("change", () => { anio = Number(selectAnio.value); cargar(); });
    selectorWrap.appendChild(selectAnio);
    container.appendChild(selectorWrap);

    if (!filas.length) {
      const empty = document.createElement("p");
      empty.className = "ac-empty";
      empty.textContent = "No hay alumnos activos.";
      container.appendChild(empty);
      return;
    }

    container.appendChild(buildPanelBlock([buildGridTable(filas, cargar)]));
  }

  cargar();
}
