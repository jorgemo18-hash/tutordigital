import { renderDiario } from "../../../profesor/js/diario.js";
import { fetchDiarioComoProfesor } from "../apiDarClase.js";

// Sección "Dar clase" del panel de admin: el diario del día y, dentro de
// cada ficha, las notas de examen.
//
// Es un ADAPTADOR, no una copia. El diario ya existía completo en el panel
// de profesor y las rutas de sesiones y notas de examen aceptan rol admin
// desde que se escribieron.
//
// EL ALCANCE ES LO IMPORTANTE: el admin ve aquí SUS alumnos asignados, no
// los del centro entero. Gestionando tiene que ver todo; dando clase, no —
// en una academia con cinco profesores, ver los alumnos de los otros cuatro
// convierte el diario en algo inservible. Por eso la llamada lleva
// `ambito=profesor` (ver apiDarClase.js). En una academia de una sola
// persona ambos conjuntos coinciden, que es lo que despista.
//
// El alcance sale de las asignaciones, que cuelgan de la ficha de profesor
// del admin — creada al encender el interruptor en Ajustes › Personal (ver
// server/lib/academiaProfesores/fichaAdmin.js).
//
// Se importa desde profesor/ en vez de mover esos archivos a una carpeta
// neutra a propósito: el diario son ~1.000 líneas repartidas en 8 módulos
// con 15 archivos de test apuntando a sus rutas actuales, y moverlo todo a
// dos semanas de que empiece el curso es mucho movimiento para cero cambio
// de comportamiento. Queda anotado como deuda: cuando haya calma, el grupo
// del diario debería vivir en assets/academia/diario/, que no es "de
// profesor" sino "del centro".
//
// `fetchMisSustitucionesFn` se anula: el aviso "hoy cubres a X" es de un
// profesor que sustituye a otro. Un admin no sustituye a nadie, y pedirlo
// sería una petición garantizada a devolver vacío en cada carga.
const MENSAJE_SIN_ALUMNOS =
  "No tienes ningún alumno asignado. Asígnate los tuyos desde Profesores para verlos aquí.";

export function createDarClaseSection({
  renderDiarioFn = renderDiario,
  fetchDiarioFn = fetchDiarioComoProfesor,
} = {}) {
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

    // El diario se pinta en su propio contenedor y no directamente en
    // `container`: renderDiario hace innerHTML="" al recargar (cambio de
    // fecha), lo que se llevaría por delante la cabecera de la sección.
    const diarioSlot = document.createElement("div");
    container.appendChild(diarioSlot);

    await renderDiarioFn(diarioSlot, {
      fetchDiarioFn,
      fetchMisSustitucionesFn: async () => [],
      // El texto por defecto dice "pídeselo al administrador". Aquí el
      // administrador es quien lo está leyendo.
      mensajeSinAlumnos: MENSAJE_SIN_ALUMNOS,
    });
  }

  return { render };
}
