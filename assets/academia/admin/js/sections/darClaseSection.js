import { renderDiario } from "../../../profesor/js/diario.js";
import { renderHorario } from "../../../profesor/js/horario.js";
import { fetchDiarioComoProfesor, fetchHorarioComoProfesor } from "../apiDarClase.js";
import { buildPestanas } from "./darClase/pestanas.js";

// Sección "Dar clase" del panel de admin: el panel de profesor completo
// —Horario y Diario— dentro de la pantalla de administración, para que el
// dueño de una academia pequeña no tenga que mantener dos cuentas.
//
// Es un ADAPTADOR, no una copia: ambas vistas ya existían en el panel de
// profesor y las rutas de sesiones, notas de examen y horario aceptan rol
// admin desde que se escribieron.
//
// EL ALCANCE ES LO IMPORTANTE. Aquí el admin ve SUS alumnos asignados, no
// los del centro entero. Gestionando tiene que ver todo — de eso se ocupan
// las secciones "Horario" y "Alumnos" del menú—; dando clase, no: en una
// academia con cinco profesores, ver los alumnos de los otros cuatro
// convierte esto en algo inservible. Por eso ambas llamadas llevan
// `ambito=profesor` (ver apiDarClase.js). En una academia de una sola
// persona los dos conjuntos coinciden, que es lo que despista.
//
// "Horario" aparecía dos veces en el panel, y con VARIOS profesores no es
// redundancia: la del menú es el horario del CENTRO (planificar, cuadrar
// plazas) y esta es el de MIS clases. Con UNO solo son la misma pantalla, y
// entonces la del menú se esconde (ver seccionesAdmin en sidebar.js).
//
// La lista de "alumnos sin horario" llegó a pintarse aquí debajo al
// esconder esa sección, y se quitó al día siguiente: Jorge la ve en
// Alumnos, y es cosa de las dos primeras semanas de curso — no de todos
// los días, que es cuando se abre esta pantalla.
//
// Se importa desde profesor/ en vez de mover esos archivos a una carpeta
// neutra a propósito: el diario y el horario son ~1.250 líneas repartidas
// en 9 módulos con 15 archivos de test apuntando a sus rutas actuales, y
// moverlo todo a dos semanas de que empiece el curso es mucho movimiento
// para cero cambio de comportamiento. Deuda anotada: su sitio es
// assets/academia/diario/ y assets/academia/horario/, que no son "de
// profesor" sino "del centro".
//
// `fetchMisSustitucionesFn` se anula en las dos: el aviso "hoy cubres a X"
// es de un profesor que sustituye a otro. Un admin no sustituye a nadie, y
// pedirlo sería una petición garantizada a devolver vacío en cada carga.
const MENSAJE_SIN_ALUMNOS =
  "No tienes ningún alumno asignado. Asígnate los tuyos desde Profesores para verlos aquí.";

const SIN_SUSTITUCIONES = async () => [];

export function createDarClaseSection({
  renderDiarioFn = renderDiario,
  renderHorarioFn = renderHorario,
  fetchDiarioFn = fetchDiarioComoProfesor,
  fetchHorarioFn = fetchHorarioComoProfesor,
} = {}) {
  // Se recuerda entre visitas a la sección: volver de Finanzas a "Dar
  // clase" no debe devolverte a Horario si estabas rellenando el diario.
  let pestanaActiva = "horario";

  function pestanas() {
    return [
      {
        id: "horario",
        label: "Horario",
        render: (el) =>
          renderHorarioFn(el, {
            fetchHorarioFn,
            fetchMisSustitucionesFn: SIN_SUSTITUCIONES,
            mensajeSinAlumnos: MENSAJE_SIN_ALUMNOS,
          }),
      },
      {
        id: "diario",
        label: "Diario",
        render: (el) =>
          renderDiarioFn(el, {
            fetchDiarioFn,
            fetchMisSustitucionesFn: SIN_SUSTITUCIONES,
            mensajeSinAlumnos: MENSAJE_SIN_ALUMNOS,
          }),
      },
    ];
  }

  async function render(container) {
    if (!container) return;
    container.innerHTML = "";

    const head = document.createElement("div");
    head.className = "ac-body-head";
    const title = document.createElement("h1");
    title.className = "ac-title";
    title.textContent = "Dar clase";
    head.appendChild(title);
    container.appendChild(head);

    const lista = pestanas();
    // Contenedor propio para el contenido: renderDiario/renderHorario hacen
    // innerHTML="" al recargar (cambio de fecha, por ejemplo), lo que se
    // llevaría por delante la cabecera y las propias pestañas.
    const slot = document.createElement("div");

    const ctl = buildPestanas(lista, {
      activaId: pestanaActiva,
      onSelect: (id) => {
        pestanaActiva = id;
        ctl.setActiva(id);
        pintar();
      },
    });
    container.appendChild(ctl.wrap);
    container.appendChild(slot);

    async function pintar() {
      slot.innerHTML = "";
      // El ancho extra es del CUADRANTE y solo de él: el Diario es una lista
      // vertical y a 1760px se queda perdida en medio de la pantalla (ver
      // .ac-main-shell--ancho en _academia-admin.css).
      container.classList.toggle("ac-main-shell--ancho", pestanaActiva === "horario");
      await lista.find((p) => p.id === pestanaActiva)?.render(slot);
    }

    await pintar();
  }

  return { render };
}
