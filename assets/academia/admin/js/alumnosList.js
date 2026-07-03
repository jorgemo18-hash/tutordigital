import { fetchAlumnosPagina, fetchPendientes, archivarAlumno } from "./api.js";
import { nivelInfo } from "./curso.js";
import { buildIcon } from "./icons.js";

const TAB_PENDIENTES = "pendientes";
const TABS = [
  { id: "activos", label: "Activos", params: { activo: true } },
  { id: "archivados", label: "Archivados", params: { activo: false } },
  { id: TAB_PENDIENTES, label: "Pendientes" },
];
const PAGE_SIZE = 30;
const BUSQUEDA_DEBOUNCE_MS = 300;

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

// Anterior/siguiente — reutiliza .ac-btn.ghost.sm y .ac-foot-hint ya
// existentes (sin CSS nuevo); layout en línea porque es la única fila así
// en esta vista. `total`/`page`/`pageSize` explícitos, sin cerrar sobre el
// estado del orquestador (ver renderAlumnos).
function buildPaginacion({ page, pageSize, total, onCambiarPagina }) {
  const wrap = document.createElement("div");
  wrap.style.display = "flex";
  wrap.style.alignItems = "center";
  wrap.style.justifyContent = "flex-end";
  wrap.style.gap = "10px";
  wrap.style.marginTop = "12px";

  const info = document.createElement("span");
  info.className = "ac-foot-hint";
  const desde = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const hasta = Math.min(page * pageSize, total);
  info.textContent = `${desde}–${hasta} de ${total} alumnos`;

  const anteriorBtn = document.createElement("button");
  anteriorBtn.type = "button";
  anteriorBtn.className = "ac-btn ghost sm";
  anteriorBtn.textContent = "Anterior";
  anteriorBtn.disabled = page <= 1;
  anteriorBtn.addEventListener("click", () => onCambiarPagina(page - 1));

  const siguienteBtn = document.createElement("button");
  siguienteBtn.type = "button";
  siguienteBtn.className = "ac-btn ghost sm";
  siguienteBtn.textContent = "Siguiente";
  siguienteBtn.disabled = page * pageSize >= total;
  siguienteBtn.addEventListener("click", () => onCambiarPagina(page + 1));

  wrap.append(info, anteriorBtn, siguienteBtn);
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

function buildArchiveConfirm(alumno, row, { onArchivarFn, onArchivado }) {
  const confirm = document.createElement("div");
  confirm.className = "ac-list-confirm";
  const texto = document.createElement("span");
  texto.textContent = `¿Archivar a ${alumno.nombre}?`;
  const actions = document.createElement("div");
  actions.className = "ac-list-confirm-actions";

  const noBtn = document.createElement("button");
  noBtn.type = "button";
  noBtn.className = "ac-btn ghost sm";
  noBtn.textContent = "No";
  noBtn.addEventListener("click", (ev) => {
    ev.stopPropagation();
    row.classList.remove("ac-list-row--confirming");
    confirm.remove();
  });

  const siBtn = document.createElement("button");
  siBtn.type = "button";
  siBtn.className = "ac-btn danger sm";
  siBtn.textContent = "Sí, archivar";
  siBtn.addEventListener("click", async (ev) => {
    ev.stopPropagation();
    siBtn.disabled = true;
    try {
      await onArchivarFn(alumno.id);
      onArchivado();
    } catch (err) {
      confirm.classList.add("error");
      texto.textContent = err.message || "No se pudo archivar el alumno.";
      siBtn.disabled = false;
    }
  });

  actions.append(noBtn, siBtn);
  confirm.append(texto, actions);
  return confirm;
}

function buildRow(alumno, onAbrir, { pendiente = false, onArchivarFn, onArchivado } = {}) {
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
  const sep = document.createElement("span");
  sep.className = "ac-list-sep";
  sep.textContent = "·";
  const curso = document.createElement("span");
  curso.className = "ac-list-curso";
  curso.textContent = alumno.curso || "";
  nameRow.append(name, sep, curso);
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

  if (onArchivarFn) {
    const archiveBtn = document.createElement("button");
    archiveBtn.type = "button";
    archiveBtn.className = "ac-list-archive-btn";
    archiveBtn.title = "Archivar alumno";
    archiveBtn.appendChild(buildIcon("archive", { size: 13 }));
    archiveBtn.addEventListener("click", (ev) => {
      ev.stopPropagation();
      if (row.classList.contains("ac-list-row--confirming")) return;
      row.classList.add("ac-list-row--confirming");
      row.appendChild(buildArchiveConfirm(alumno, row, { onArchivarFn, onArchivado }));
    });
    row.appendChild(archiveBtn);
  }

  return row;
}

export async function renderAlumnos(container, {
  onAbrirAlumno,
  onNuevoAlumno,
  fetchAlumnosPaginaFn = fetchAlumnosPagina,
  fetchPendientesFn = fetchPendientes,
  archivarAlumnoFn = archivarAlumno,
} = {}) {
  if (!container) return null;
  let activeTabId = "activos";
  let query = "";
  let alumnos = [];
  let pendientesCount = 0;
  // Paginación en servidor (activos/archivados) — Pendientes no pagina, es
  // otra fuente (fetchPendientesFn, sin page/pageSize) y normalmente una
  // lista corta, así que ahí se mantiene el filtro de nombre en cliente.
  let page = 1;
  let total = 0;
  let debounceTimer = null;
  // Identificador de la última llamada a cargar() — con la latencia variable
  // de este backend, una petición vieja (tab/página/búsqueda anteriores)
  // puede resolver después de una más nueva y pisar la lista con datos que
  // ya no corresponden. Cada cargar() se queda con su propio id al empezar
  // y, si al resolver ya no es el más reciente, descarta el resultado sin
  // tocar el DOM.
  let cargaId = 0;

  container.innerHTML = "";
  container.appendChild(buildBodyHead(onNuevoAlumno));

  const bannerSlot = document.createElement("div");
  container.appendChild(bannerSlot);

  function renderBanner() {
    bannerSlot.innerHTML = "";
    if (!pendientesCount) return;
    bannerSlot.appendChild(
      buildPendientesBanner(pendientesCount, () => {
        clearTimeout(debounceTimer);
        activeTabId = TAB_PENDIENTES;
        tabsCtl.setActive(TAB_PENDIENTES);
        cargar();
      })
    );
  }

  const tabsCtl = buildTabs(activeTabId, (tabId) => {
    clearTimeout(debounceTimer);
    activeTabId = tabId;
    page = 1;
    tabsCtl.setActive(tabId);
    cargar();
  });
  container.appendChild(tabsCtl.wrap);
  container.appendChild(
    buildSearch((value) => {
      query = value;
      if (activeTabId === TAB_PENDIENTES) {
        renderLista();
        return;
      }
      // Búsqueda en servidor (ver GET /academia/alumnos?q=) — con debounce
      // porque cada tecleo ahora es una petición, no un filtro en memoria.
      page = 1;
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(cargar, BUSQUEDA_DEBOUNCE_MS);
    })
  );

  const listEl = document.createElement("div");
  listEl.className = "ac-list";
  container.appendChild(listEl);

  function renderLista() {
    listEl.innerHTML = "";
    const pendiente = activeTabId === TAB_PENDIENTES;
    const q = query.trim().toLowerCase();
    // Solo Pendientes filtra aquí — activos/archivados ya llegan filtrados
    // y paginados desde el servidor.
    const itemsAMostrar = pendiente && q
      ? alumnos.filter((a) => String(a.nombre || "").toLowerCase().includes(q))
      : alumnos;
    if (!itemsAMostrar.length) {
      const empty = document.createElement("p");
      empty.className = "ac-empty";
      empty.textContent = "No hay alumnos que coincidan.";
      listEl.appendChild(empty);
      return;
    }
    for (const alumno of itemsAMostrar) {
      listEl.appendChild(
        buildRow(alumno, onAbrirAlumno, {
          pendiente,
          onArchivarFn: archivarAlumnoFn,
          onArchivado: () => { cargar(); cargarPendientesCount(); },
        })
      );
    }
    if (!pendiente) {
      listEl.appendChild(
        buildPaginacion({
          page,
          pageSize: PAGE_SIZE,
          total,
          onCambiarPagina: (nuevaPagina) => {
            clearTimeout(debounceTimer);
            page = nuevaPagina;
            cargar();
          },
        })
      );
    }
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
    const idActual = ++cargaId;
    listEl.innerHTML = '<p class="ac-loading">Cargando alumnos…</p>';
    try {
      let nuevosAlumnos;
      let nuevoTotal = total;
      let nuevaPagina = page;
      if (activeTabId === TAB_PENDIENTES) {
        nuevosAlumnos = await fetchPendientesFn();
      } else {
        const tab = TABS.find((t) => t.id === activeTabId);
        const resultado = await fetchAlumnosPaginaFn({ ...tab.params, q: query.trim() || undefined, page, pageSize: PAGE_SIZE });
        nuevosAlumnos = resultado.alumnos;
        nuevoTotal = resultado.total;
        nuevaPagina = resultado.page;
      }
      // Una llamada a cargar() más reciente (otra pestaña, página o
      // búsqueda) ya ganó mientras esta esperaba al servidor — se descarta
      // en silencio, sin tocar alumnos/total/page ni el DOM.
      if (idActual !== cargaId) return;
      alumnos = nuevosAlumnos;
      total = nuevoTotal;
      page = nuevaPagina;
      renderLista();
    } catch (err) {
      if (idActual !== cargaId) return;
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
