import { fetchAlumnos, fetchPendientes } from "./api.js";
import { nivelInfo } from "./curso.js";
import { buildIcon } from "./icons.js";

const TAB_PENDIENTES = "pendientes";
const TABS = [
  { id: "activos", label: "Activos", params: { activo: true } },
  { id: "sin_familia", label: "Sin familia", params: { activo: true, sinFamilia: true } },
  { id: "archivados", label: "Archivados", params: { activo: false } },
  { id: TAB_PENDIENTES, label: "Pendientes" },
];

function buildPendientesBanner(count, onClick) {
  const banner = document.createElement("div");
  banner.className = "ac-banner amber";
  banner.textContent = `⚠ ${count} ${count === 1 ? "inscripción" : "inscripciones"} pendientes de revisar`;
  banner.addEventListener("click", onClick);
  return banner;
}

function buildBodyHead(onNuevoAlumno) {
  const head = document.createElement("div");
  head.className = "ac-body-head";
  const title = document.createElement("h1");
  title.className = "ac-title";
  title.textContent = "Alumnos";
  const nuevoBtn = document.createElement("button");
  nuevoBtn.type = "button";
  nuevoBtn.className = "ac-btn primary";
  nuevoBtn.textContent = "+ Nuevo alumno";
  nuevoBtn.addEventListener("click", onNuevoAlumno);
  head.append(title, nuevoBtn);
  return head;
}

function buildTabs(activeId, onSelect) {
  const wrap = document.createElement("div");
  wrap.className = "ac-list-tabs";
  const buttons = new Map();
  for (const tab of TABS) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "ac-list-tab";
    btn.textContent = tab.label;
    btn.addEventListener("click", () => onSelect(tab.id));
    wrap.appendChild(btn);
    buttons.set(tab.id, btn);
  }
  function setActive(tabId) {
    for (const [id, btn] of buttons) btn.classList.toggle("active", id === tabId);
  }
  setActive(activeId);
  return { wrap, setActive };
}

function buildSearch(onInput) {
  const wrap = document.createElement("div");
  wrap.className = "ac-search";
  const input = document.createElement("input");
  input.type = "search";
  input.placeholder = "Buscar por nombre…";
  input.addEventListener("input", () => onInput(input.value));
  wrap.appendChild(input);
  return wrap;
}

function initials(nombre) {
  const palabras = String(nombre || "").trim().split(/\s+/).filter(Boolean);
  if (!palabras.length) return "—";
  if (palabras.length === 1) return palabras[0].slice(0, 2).toUpperCase();
  return (palabras[0][0] + palabras[1][0]).toUpperCase();
}

function formatPrecio(alumno) {
  const precio = alumno.tarifa_vigente?.precio_neto;
  if (precio == null) return "";
  return `${Number(precio).toFixed(2)} €/mes`;
}

function buildRow(alumno, onAbrir, { pendiente = false } = {}) {
  const row = document.createElement("div");
  row.className = "ac-list-row";
  row.addEventListener("click", () => onAbrir(alumno));

  const avatar = document.createElement("div");
  avatar.className = "ac-list-avatar";
  avatar.textContent = initials(alumno.nombre);
  row.appendChild(avatar);

  const id = document.createElement("div");
  id.className = "ac-list-row-id";
  const nameRow = document.createElement("div");
  nameRow.className = "ac-list-row-left";
  const name = document.createElement("span");
  name.className = "ac-list-name";
  name.textContent = alumno.nombre || "(sin nombre)";
  const curso = document.createElement("span");
  curso.className = "ac-list-curso";
  curso.textContent = alumno.curso || "";
  nameRow.append(name, curso);
  const lvTag = document.createElement("span");
  if (pendiente) {
    lvTag.className = "ac-lv pendiente";
    lvTag.textContent = "PENDIENTE";
  } else {
    const lv = nivelInfo(alumno.nivel);
    lvTag.className = `ac-lv ${lv.cls}`;
    lvTag.textContent = lv.label;
  }
  nameRow.appendChild(lvTag);
  id.appendChild(nameRow);
  row.appendChild(id);

  const familia = document.createElement("div");
  familia.className = "ac-list-familia";
  if (alumno.familia?.nombre) {
    const tutor = document.createElement("span");
    tutor.className = "ac-list-familia-nombre";
    tutor.textContent = alumno.familia.nombre;
    familia.appendChild(tutor);
  }
  if (alumno.familia?.email) {
    const email = document.createElement("span");
    email.className = "ac-list-email";
    email.textContent = alumno.familia.email;
    familia.appendChild(email);
  }
  row.appendChild(familia);

  const precio = document.createElement("span");
  precio.className = "ac-list-precio";
  precio.textContent = formatPrecio(alumno);
  row.appendChild(precio);

  const copyBtn = document.createElement("button");
  copyBtn.type = "button";
  copyBtn.className = "ac-copy-btn";
  copyBtn.title = "Copiar email";
  copyBtn.style.visibility = alumno.familia?.email ? "visible" : "hidden";
  copyBtn.appendChild(buildIcon("copy", { size: 12 }));
  copyBtn.addEventListener("click", (ev) => {
    ev.stopPropagation();
    if (alumno.familia?.email) navigator.clipboard?.writeText(alumno.familia.email);
  });
  row.appendChild(copyBtn);

  const arrow = document.createElement("span");
  arrow.className = "ac-list-arrow";
  arrow.appendChild(buildIcon("chevronRight", { size: 16 }));
  row.appendChild(arrow);

  return row;
}

export async function renderAlumnos(container, {
  onAbrirAlumno,
  onNuevoAlumno,
  fetchAlumnosFn = fetchAlumnos,
  fetchPendientesFn = fetchPendientes,
} = {}) {
  if (!container) return null;
  let activeTabId = "activos";
  let query = "";
  let alumnos = [];
  let pendientesCount = 0;

  container.innerHTML = "";
  container.appendChild(buildBodyHead(onNuevoAlumno));

  const bannerSlot = document.createElement("div");
  container.appendChild(bannerSlot);

  function renderBanner() {
    bannerSlot.innerHTML = "";
    if (!pendientesCount) return;
    bannerSlot.appendChild(
      buildPendientesBanner(pendientesCount, () => {
        activeTabId = TAB_PENDIENTES;
        tabsCtl.setActive(TAB_PENDIENTES);
        cargar();
      })
    );
  }

  const tabsCtl = buildTabs(activeTabId, (tabId) => {
    activeTabId = tabId;
    tabsCtl.setActive(tabId);
    cargar();
  });
  container.appendChild(tabsCtl.wrap);
  container.appendChild(buildSearch((value) => { query = value; renderLista(); }));

  const listEl = document.createElement("div");
  listEl.className = "ac-list";
  container.appendChild(listEl);

  function renderLista() {
    listEl.innerHTML = "";
    const q = query.trim().toLowerCase();
    const filtrados = q ? alumnos.filter((a) => String(a.nombre || "").toLowerCase().includes(q)) : alumnos;
    if (!filtrados.length) {
      const empty = document.createElement("p");
      empty.className = "ac-empty";
      empty.textContent = "No hay alumnos que coincidan.";
      listEl.appendChild(empty);
      return;
    }
    const pendiente = activeTabId === TAB_PENDIENTES;
    for (const alumno of filtrados) listEl.appendChild(buildRow(alumno, onAbrirAlumno, { pendiente }));
  }

  async function cargarPendientesCount() {
    try {
      pendientesCount = (await fetchPendientesFn()).length;
      renderBanner();
    } catch {
      // el banner es informativo — si falla, simplemente no se muestra
    }
  }

  async function cargar() {
    listEl.innerHTML = '<p class="ac-loading">Cargando alumnos…</p>';
    try {
      if (activeTabId === TAB_PENDIENTES) {
        alumnos = await fetchPendientesFn();
      } else {
        const tab = TABS.find((t) => t.id === activeTabId);
        alumnos = await fetchAlumnosFn(tab.params);
      }
      renderLista();
    } catch (err) {
      listEl.innerHTML = `<p class="ac-error">${err.message || "Error al cargar alumnos."}</p>`;
    }
  }

  await Promise.all([cargar(), cargarPendientesCount()]);
  return {
    reload: async () => {
      await cargar();
      await cargarPendientesCount();
    },
  };
}
