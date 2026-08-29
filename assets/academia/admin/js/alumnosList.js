import { fetchAlumnosPagina, fetchPendientes, archivarAlumno, restaurarAlumno, eliminarAlumnoDefinitivo } from "./api.js";
import { buildRow } from "./alumnosListRow.js";
import { escHtml } from "../../../shared/js/escHtml.js";

// Tres estados, no dos: un alumno guardado a medias es un BORRADOR (nunca
// llegó a estar de alta), y un archivado es alguien que sí lo estuvo y se
// dio de baja. Antes "Archivados" pedía activo=false, que se llevaba
// también los borradores, y el mismo alumno salía en las dos pestañas.
// Ver server/lib/academiaAlumnos/estado.js.
const TAB_BORRADORES = "borradores";
const TABS = [
  { id: "activos", label: "Activos", params: { estado: "activo" } },
  { id: "archivados", label: "Archivados", params: { estado: "archivado" } },
  // Los borradores se piden por su propio endpoint (fetchPendientes), el
  // mismo que alimenta el banner y el contador, para que listado y aviso no
  // puedan discrepar. Por eso no lleva `params`.
  { id: TAB_BORRADORES, label: "Borradores" },
];
const PAGE_SIZE = 30;
const BUSQUEDA_DEBOUNCE_MS = 300;
// Al volver a esta pestaña/ventana refrescamos pendientes (banner + tab) sin
// esperar a un F5 — con este mínimo entre refrescos para no disparar una
// petición en cada cambio de pestaña del navegador.
const REFRESCO_VISIBILIDAD_MIN_MS = 15000;

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

export async function renderAlumnos(container, {
  onAbrirAlumno,
  onNuevoAlumno,
  fetchAlumnosPaginaFn = fetchAlumnosPagina,
  fetchPendientesFn = fetchPendientes,
  archivarAlumnoFn = archivarAlumno,
  restaurarAlumnoFn = restaurarAlumno,
  eliminarAlumnoDefinitivoFn = eliminarAlumnoDefinitivo,
} = {}) {
  if (!container) return null;
  // renderAlumnos se vuelve a invocar cada vez que se navega a esta pestaña
  // (ver SECTION_RENDERERS.alumnos en academiaAdmin.js) — sin esto, cada
  // visita dejaría sus propios listeners de visibilitychange/focus vivos en
  // document/window (nunca se limpian solos al reconstruir el DOM interno).
  container._alumnosCleanup?.();
  let activeTabId = "activos";
  let query = "";
  let alumnos = [];
  let pendientesCount = 0;
  // Paginación en servidor (activos/archivados) — Borradores no pagina, es
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
        activeTabId = TAB_BORRADORES;
        tabsCtl.setActive(TAB_BORRADORES);
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
      if (activeTabId === TAB_BORRADORES) {
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
    const esBorrador = activeTabId === TAB_BORRADORES;
    const q = query.trim().toLowerCase();
    // Solo Pendientes filtra aquí — activos/archivados ya llegan filtrados
    // y paginados desde el servidor.
    const itemsAMostrar = esBorrador && q
      ? alumnos.filter((a) => String(a.nombre || "").toLowerCase().includes(q))
      : alumnos;
    if (!itemsAMostrar.length) {
      const empty = document.createElement("p");
      empty.className = "ac-empty";
      empty.textContent = "No hay alumnos que coincidan.";
      listEl.appendChild(empty);
      return;
    }
    const archivado = activeTabId === "archivados";
    for (const alumno of itemsAMostrar) {
      listEl.appendChild(
        buildRow(alumno, onAbrirAlumno, {
          borrador: esBorrador,
          archivado,
          onArchivarFn: archivarAlumnoFn,
          onRestaurarFn: restaurarAlumnoFn,
          onEliminarFn: eliminarAlumnoDefinitivoFn,
          onArchivado: () => { cargar(); cargarPendientesCount(); },
        })
      );
    }
    if (!esBorrador) {
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
      if (activeTabId === TAB_BORRADORES) {
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
      listEl.innerHTML = `<p class="ac-error">${escHtml(err.message || "Error al cargar alumnos.")}</p>`;
    }
  }

  await Promise.all([cargar(), cargarPendientesCount()]);

  // Refresco al recuperar visibilidad/foco: el banner y el contador de
  // Pendientes se quedaban desactualizados hasta recargar la página cuando
  // un alumno completaba su invitación con el panel ya abierto. Si la
  // pestaña activa es Pendientes, su listado usa la misma llamada
  // (fetchPendientesFn) que el banner/contador, así que también se refresca.
  let ultimoRefrescoEn = Date.now();
  function refrescarSiToca() {
    if (document.visibilityState !== "visible") return;
    const ahora = Date.now();
    if (ahora - ultimoRefrescoEn < REFRESCO_VISIBILIDAD_MIN_MS) return;
    ultimoRefrescoEn = ahora;
    cargarPendientesCount();
    if (activeTabId === TAB_BORRADORES) cargar();
  }
  const visibilidadCtl = new AbortController();
  document.addEventListener("visibilitychange", refrescarSiToca, { signal: visibilidadCtl.signal });
  window.addEventListener("focus", refrescarSiToca, { signal: visibilidadCtl.signal });
  container._alumnosCleanup = () => visibilidadCtl.abort();

  return {
    reload: async () => {
      await cargar();
      await cargarPendientesCount();
    },
  };
}
