import { fetchTrabajadoresFichaje, fetchFichajes, registrarCorreccionFichaje } from "../apiFichajes.js";
import { buildPeriodoSelector } from "./envioFamilias/periodoSelector.js";
import { buildAutoFichajeWidget } from "./fichajes/autoFichajeWidget.js";
import { buildTablaFichajes } from "./fichajes/tablaFichajes.js";
import { abrirCorreccionDialog } from "./fichajes/correccionDialog.js";
import { buildExportarBotones } from "./fichajes/exportarBotones.js";

function periodoActual() {
  const hoy = new Date();
  return { mes: hoy.getMonth() + 1, anio: hoy.getFullYear() };
}

function buildSelectorTrabajador(trabajadores, { onChange }) {
  const select = document.createElement("select");
  select.className = "ac-select";
  const optVacia = document.createElement("option");
  optVacia.value = "";
  optVacia.textContent = "Elige un trabajador…";
  select.appendChild(optVacia);
  for (const t of trabajadores) {
    const opt = document.createElement("option");
    opt.value = t.profileId;
    opt.textContent = `${t.nombre} (${t.role === "admin" ? "Admin" : "Profesor"})`;
    select.appendChild(opt);
  }
  select.addEventListener("change", () => onChange(select.value || null));
  return select;
}

// Sección "Control horario" del sidebar — solo existe si el tenant activó
// el toggle (ver personalTab.js/academiaAdmin.js). Dos bloques
// independientes: arriba, el autofichaje de quien esté usando el panel
// ahora mismo; abajo, la gestión de CUALQUIER trabajador del centro
// (consulta + corrección + exportación) — son cosas distintas, un admin
// puede querer corregir el fichaje de otra persona sin que eso afecte al
// suyo propio.
export function createFichajesSection() {
  let { mes, anio } = periodoActual();
  const anioActualSistema = anio;
  let trabajadores = [];
  let workerProfileId = null;
  let tablaWrap = null;
  let msgEl = null;

  async function cargarTabla() {
    tablaWrap.innerHTML = "";
    if (!workerProfileId) {
      const p = document.createElement("p");
      p.className = "ac-empty";
      p.textContent = "Elige un trabajador para ver su control horario.";
      tablaWrap.appendChild(p);
      return;
    }
    tablaWrap.appendChild(Object.assign(document.createElement("p"), { className: "ac-loading", textContent: "Cargando…" }));
    try {
      const fichajes = await fetchFichajes({ worker_profile_id: workerProfileId, mes, anio });
      tablaWrap.innerHTML = "";
      tablaWrap.appendChild(buildTablaFichajes(fichajes, { onCorregir }));
    } catch (err) {
      tablaWrap.innerHTML = "";
      tablaWrap.appendChild(Object.assign(document.createElement("p"), { className: "ac-error", textContent: err.message || "No se pudieron cargar los fichajes." }));
    }
  }

  async function ejecutarCorreccion(tipoSugerido, fichajeCorregidoId) {
    const eleccion = await abrirCorreccionDialog({ tipoSugerido });
    if (!eleccion) return;
    msgEl.textContent = "";
    try {
      await registrarCorreccionFichaje({
        worker_profile_id: workerProfileId,
        tipo: eleccion.tipo,
        fichaje_corregido_id: fichajeCorregidoId,
        motivo: eleccion.motivo,
        notas: eleccion.notas,
      });
      msgEl.textContent = "✓ Corrección guardada";
      msgEl.className = "ac-drawer-msg ok";
      await cargarTabla();
    } catch (err) {
      msgEl.textContent = err.message || "No se pudo guardar la corrección.";
      msgEl.className = "ac-drawer-msg error";
    }
  }

  function onCorregir(fichaje) {
    ejecutarCorreccion(fichaje.tipo, fichaje.id);
  }

  function render(container) {
    container.innerHTML = "";

    const head = document.createElement("div");
    head.className = "ac-body-head";
    const title = document.createElement("h1");
    title.className = "ac-title";
    title.textContent = "Control horario";
    head.appendChild(title);
    container.appendChild(head);

    container.appendChild(buildAutoFichajeWidget());

    const gestion = document.createElement("div");
    gestion.className = "ac-panel";

    const filaControles = document.createElement("div");
    filaControles.className = "ef-head-acciones";

    const selectorTrabajadorWrap = document.createElement("div");
    fetchTrabajadoresFichaje()
      .then((data) => {
        trabajadores = data;
        selectorTrabajadorWrap.innerHTML = "";
        selectorTrabajadorWrap.appendChild(buildSelectorTrabajador(trabajadores, {
          onChange: (id) => { workerProfileId = id; cargarTabla(); },
        }));
      })
      .catch(() => {
        selectorTrabajadorWrap.textContent = "No se pudieron cargar los trabajadores.";
      });
    filaControles.appendChild(selectorTrabajadorWrap);

    filaControles.appendChild(buildPeriodoSelector({
      mes, anio, anioActualSistema,
      onChange: ({ mes: m, anio: a }) => { mes = m; anio = a; cargarTabla(); },
    }));

    const correccionBtn = document.createElement("button");
    correccionBtn.type = "button";
    correccionBtn.className = "ac-btn copper";
    correccionBtn.textContent = "Añadir corrección";
    correccionBtn.addEventListener("click", () => {
      if (!workerProfileId) { msgEl.textContent = "Elige antes un trabajador."; msgEl.className = "ac-drawer-msg error"; return; }
      ejecutarCorreccion("entrada", null);
    });
    filaControles.appendChild(correccionBtn);

    filaControles.appendChild(buildExportarBotones({ getContexto: () => ({ workerProfileId, mes, anio }) }));

    gestion.appendChild(filaControles);

    msgEl = document.createElement("span");
    msgEl.className = "ac-drawer-msg";
    gestion.appendChild(msgEl);

    tablaWrap = document.createElement("div");
    gestion.appendChild(tablaWrap);
    cargarTabla();

    container.appendChild(gestion);
  }

  return { render };
}
