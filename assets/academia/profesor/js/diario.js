import { fetchDiario } from "./api.js";
import { buildDiarioRow, estadoDeEntry } from "./diarioCard.js";
import { createDiarioDrawer } from "./diarioDrawer.js";
import { buildIcon } from "./icons.js";

const DIA_MS = 24 * 60 * 60 * 1000;
const RANGO_DIAS_ATRAS = 30;
const DIAS_SEMANA = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"];
const MESES = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];

// El drawer es un único elemento reutilizado entre aperturas — renderDiario()
// se vuelve a ejecutar cada vez que se entra en la pestaña Diario, así que
// crearlo aquí (una vez por carga de página, no por cada render) evita
// acumular overlays duplicados en el DOM.
let sharedDrawer = null;
function getDrawer(root) {
  if (!sharedDrawer) sharedDrawer = createDiarioDrawer(root);
  return sharedDrawer;
}

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

function formatFechaLabel(fechaISO) {
  const [y, m, d] = fechaISO.split("-").map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  return `${DIAS_SEMANA[date.getUTCDay()][0].toUpperCase()}${DIAS_SEMANA[date.getUTCDay()].slice(1)} ${d} de ${MESES[m - 1]}`;
}

function buildDateNav(fecha, onChange) {
  const nav = document.createElement("div");
  nav.className = "ac-datenav";

  const prevBtn = document.createElement("button");
  prevBtn.type = "button";
  prevBtn.className = "ac-date-arrow";
  prevBtn.appendChild(buildIcon("left", { size: 16 }));
  prevBtn.addEventListener("click", () => onChange(clampToRange(shiftISO(fecha, -1))));
  nav.appendChild(prevBtn);

  const center = document.createElement("div");
  center.className = "ac-date-center";
  const today = document.createElement("div");
  today.className = "ac-date-today";
  today.textContent = fecha === todayISO() ? "Hoy" : DIAS_SEMANA[(() => {
    const [y, m, d] = fecha.split("-").map(Number);
    return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
  })()];
  const label = document.createElement("div");
  label.className = "ac-date-label";
  label.textContent = formatFechaLabel(fecha);
  center.append(today, label);
  nav.appendChild(center);

  const nextBtn = document.createElement("button");
  nextBtn.type = "button";
  nextBtn.className = "ac-date-arrow";
  nextBtn.disabled = fecha >= todayISO();
  nextBtn.appendChild(buildIcon("right", { size: 16 }));
  nextBtn.addEventListener("click", () => onChange(clampToRange(shiftISO(fecha, 1))));
  nav.appendChild(nextBtn);

  return nav;
}

function buildBodyHead(alumnos) {
  const head = document.createElement("div");
  head.className = "ac-body-head";

  const titleBox = document.createElement("div");
  const title = document.createElement("h1");
  title.className = "ac-title";
  title.style.fontSize = "26px";
  title.innerHTML = 'Diario del <em>día</em>';
  const sub = document.createElement("div");
  sub.className = "ac-sub";
  sub.textContent = `${alumnos.length} ${alumnos.length === 1 ? "alumno" : "alumnos"} con clase`;
  titleBox.append(title, sub);
  head.appendChild(titleBox);

  const guardados = alumnos.filter((e) => estadoDeEntry(e) === "guardado").length;
  const pendientes = alumnos.filter((e) => estadoDeEntry(e) === "pendiente").length;
  const legend = document.createElement("div");
  legend.className = "ac-legend";
  const item = document.createElement("span");
  item.className = "ac-legend-item";
  item.textContent = `${guardados} guardados · ${pendientes} pendientes`;
  legend.appendChild(item);
  head.appendChild(legend);

  return head;
}

// Construye la lista de filas a partir de datos ya cargados (`lista`). Cada
// fila abre el drawer compartido al hacer clic — el propio drawer decide su
// modo inicial (clase/ausente) según el estado ya guardado del alumno.
function buildLista(lista, fecha, drawer, onGuardado) {
  const listEl = document.createElement("div");
  listEl.className = "ac-diario-list";
  if (lista.length === 0) {
    const empty = document.createElement("p");
    empty.className = "ac-empty";
    empty.textContent = "Sin alumnos con clase este día.";
    listEl.appendChild(empty);
    return listEl;
  }
  for (const entry of lista) {
    listEl.appendChild(
      buildDiarioRow(entry, {
        onAbrir: () => drawer.open(entry, fecha, { onGuardado: (saved) => onGuardado(entry, saved) }),
      })
    );
  }
  return listEl;
}

export async function renderDiario(container, { fetchDiarioFn = fetchDiario, fechaInicial } = {}) {
  if (!container) return;
  let fecha = clampToRange(fechaInicial || todayISO());
  let lista = [];
  let bodyHeadEl = null;
  let listEl = null;

  // El overlay del drawer necesita vivir dentro de .ac-frame para heredar la
  // clase de tema (ac-claro/ac-oscuro) — a diferencia de otros paneles, aquí
  // el tema se aplica por clase en vez de por atributo global en <html>.
  const drawerRoot = container.closest(".ac-frame") || document.body;
  const drawer = getDrawer(drawerRoot);

  // Actualiza la fila y la cabecera en el sitio con el resultado del POST —
  // evita recargar todo el diario solo porque un alumno se guardó.
  function onGuardado(entry, savedSesion) {
    entry.sesion = savedSesion;
    const nuevoHead = buildBodyHead(lista);
    bodyHeadEl.replaceWith(nuevoHead);
    bodyHeadEl = nuevoHead;
    const nuevaLista = buildLista(lista, fecha, drawer, onGuardado);
    listEl.replaceWith(nuevaLista);
    listEl = nuevaLista;
  }

  async function fetchYRender() {
    container.innerHTML = "";
    container.appendChild(buildDateNav(fecha, (nuevaFecha) => {
      fecha = nuevaFecha;
      fetchYRender();
    }));

    const loading = document.createElement("p");
    loading.className = "ac-loading";
    loading.textContent = "Cargando diario…";
    container.appendChild(loading);

    try {
      const { alumnos } = await fetchDiarioFn(fecha);
      lista = alumnos || [];
      loading.remove();
      bodyHeadEl = buildBodyHead(lista);
      container.appendChild(bodyHeadEl);
      listEl = buildLista(lista, fecha, drawer, onGuardado);
      container.appendChild(listEl);
    } catch (err) {
      loading.className = "ac-error";
      loading.textContent = err.message || "Error al cargar el diario.";
    }
  }

  await fetchYRender();
}
