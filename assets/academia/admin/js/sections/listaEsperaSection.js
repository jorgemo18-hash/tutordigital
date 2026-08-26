import {
  fetchListaEspera,
  crearEntradaListaEspera,
  actualizarEntradaListaEspera,
  eliminarEntradaListaEspera,
} from "../apiListaEspera.js";
import { buildFormularioAlta } from "./listaEspera/formulario.js";
import { buildFila } from "./listaEspera/fila.js";

const CABECERAS = ["Nombre", "Curso", "Teléfono", "Email", "Notas", ""];

function buildHead() {
  const head = document.createElement("div");
  head.className = "ac-body-head";
  const title = document.createElement("h1");
  title.className = "ac-title";
  title.textContent = "Lista de espera";
  head.appendChild(title);
  return head;
}

function mensajeSimple(texto, className) {
  return Object.assign(document.createElement("p"), { className, textContent: texto });
}

// Mismo patrón que createSustitucionesSection: deps inyectables para test,
// un único msgEl reutilizado para el feedback de añadir/editar/eliminar.
//
// `onMatricular` lo inyecta academiaAdmin.js y abre el drawer de alumno de
// la sección Alumnos con los datos ya puestos — la lista de espera no
// conoce drawers. Resuelve a true si de verdad se creó el alumno, y solo
// entonces se borra la entrada: al revés (borrar y luego crear) un cierre
// del drawer a mitad perdería el contacto para siempre.
export function createListaEsperaSection({
  fetchListaEsperaFn = fetchListaEspera,
  crearEntradaFn = crearEntradaListaEspera,
  actualizarEntradaFn = actualizarEntradaListaEspera,
  eliminarEntradaFn = eliminarEntradaListaEspera,
  onMatricular = null,
  confirmFn = (mensaje) => window.confirm(mensaje),
} = {}) {
  let tableSlot = null;
  let msgEl = null;
  let formulario = null;
  let entradas = [];
  // Id de la entrada que se está editando en línea, o null. Vive aquí (y
  // no en la fila) para que abrir una edición cierre cualquier otra: dos
  // filas editables a la vez invitan a perder cambios sin avisar.
  let editandoId = null;

  function mostrarError(err, porDefecto) {
    msgEl.textContent = err?.message || porDefecto;
    msgEl.className = "ac-drawer-msg error";
  }

  function limpiarMensaje() {
    msgEl.textContent = "";
    msgEl.className = "ac-drawer-msg";
  }

  async function onAdd(datos) {
    limpiarMensaje();
    formulario.setOcupado(true);
    try {
      await crearEntradaFn(datos);
      formulario.limpiar();
      formulario.foco();
      await cargarTabla();
    } catch (err) {
      mostrarError(err, "No se pudo añadir a la lista de espera.");
    } finally {
      formulario.setOcupado(false);
    }
  }

  async function onGuardarEdicion(entrada, cambios, { setOcupado }) {
    limpiarMensaje();
    // Salir de la edición sin haber tocado nada no es un error ni merece
    // una petición: se cierra la fila y ya.
    if (!Object.keys(cambios).length) {
      editandoId = null;
      pintarTabla();
      return;
    }
    setOcupado(true);
    try {
      await actualizarEntradaFn(entrada.id, cambios);
      editandoId = null;
      await cargarTabla();
    } catch (err) {
      setOcupado(false);
      mostrarError(err, "No se pudo guardar el cambio.");
    }
  }

  // El borrado es definitivo (DELETE real, sin papelera) y hasta ahora
  // ocurría con un solo clic, sin preguntar: un roce en el icono
  // equivocado y el contacto desaparecía sin forma de recuperarlo.
  async function onEliminar(entrada) {
    limpiarMensaje();
    const aviso = `¿Eliminar a ${entrada.nombre} de la lista de espera? Esta acción no se puede deshacer.`;
    if (!confirmFn(aviso)) return;
    try {
      await eliminarEntradaFn(entrada.id);
      await cargarTabla();
    } catch (err) {
      mostrarError(err, "No se pudo eliminar de la lista de espera.");
    }
  }

  // Crear el alumno primero y borrar la entrada después. Si el admin cierra
  // el drawer a medias no se ha perdido nada; y si el borrado fallara tras
  // crear al alumno, lo peor es un contacto duplicado en la lista, que se
  // quita a mano. El orden inverso podría destruir el contacto sin haber
  // creado nada.
  async function onMatricularEntrada(entrada) {
    limpiarMensaje();
    if (!onMatricular) return;
    let creado = false;
    try {
      creado = await onMatricular(entrada);
    } catch (err) {
      mostrarError(err, "No se pudo abrir la ficha del alumno.");
      return;
    }
    if (!creado) return;
    try {
      await eliminarEntradaFn(entrada.id);
    } catch {
      msgEl.textContent = `${entrada.nombre} se dio de alta como alumno, pero sigue en la lista de espera: elimínalo a mano.`;
      msgEl.className = "ac-drawer-msg error";
    }
    await cargarTabla();
  }

  function buildTable() {
    const wrap = document.createElement("div");
    wrap.className = "ac-table-wrap";
    if (!entradas.length) {
      wrap.appendChild(mensajeSimple("La lista de espera está vacía.", "ac-empty"));
      return wrap;
    }

    const table = document.createElement("table");
    table.className = "ac-table";
    const thead = document.createElement("thead");
    const trHead = document.createElement("tr");
    for (const texto of CABECERAS) {
      const th = document.createElement("th");
      th.textContent = texto;
      trHead.appendChild(th);
    }
    thead.appendChild(trHead);
    table.appendChild(thead);

    const tbody = document.createElement("tbody");
    for (const entrada of entradas) {
      tbody.appendChild(
        buildFila(entrada, {
          editando: entrada.id === editandoId,
          onEditar: (e) => { editandoId = e.id; limpiarMensaje(); pintarTabla(); },
          onCancelar: () => { editandoId = null; pintarTabla(); },
          onGuardar: onGuardarEdicion,
          onEliminar,
          onMatricular: onMatricularEntrada,
        })
      );
    }
    table.appendChild(tbody);
    wrap.appendChild(table);
    return wrap;
  }

  // Repinta con lo que ya hay en memoria (cambiar de fila en edición, por
  // ejemplo) sin volver a pedir la lista al servidor.
  function pintarTabla() {
    tableSlot.innerHTML = "";
    // .ac-table-wrap solo da overflow-x:auto — sin envolverlo en .ac-panel
    // la tabla queda directamente sobre la foto de fondo del panel.
    const panel = document.createElement("div");
    panel.className = "ac-panel";
    panel.appendChild(buildTable());
    tableSlot.appendChild(panel);
  }

  async function cargarTabla() {
    tableSlot.innerHTML = "";
    tableSlot.appendChild(mensajeSimple("Cargando…", "ac-loading"));
    try {
      entradas = await fetchListaEsperaFn();
      pintarTabla();
    } catch (err) {
      tableSlot.innerHTML = "";
      tableSlot.appendChild(mensajeSimple(err?.message || "No se pudo cargar la lista de espera.", "ac-error"));
    }
  }

  function render(container) {
    if (!container) return;
    container.innerHTML = "";
    container.appendChild(buildHead());

    msgEl = document.createElement("span");
    msgEl.className = "ac-drawer-msg";
    container.appendChild(msgEl);

    editandoId = null;
    formulario = buildFormularioAlta({ onAdd });
    container.appendChild(formulario.el);

    tableSlot = document.createElement("div");
    container.appendChild(tableSlot);
    cargarTabla();
  }

  return { render };
}
