import { renderDiario } from "../../../profesor/js/diario.js";

// Sección "Dar clase" del panel de admin: el diario del día y, dentro de
// cada ficha, las notas de examen.
//
// Es un ADAPTADOR, no una copia. El diario ya existía completo en el panel
// de profesor y funciona igual para el admin sin tocar el servidor: las
// rutas de sesiones y notas de examen aceptan rol admin desde que se
// escribieron, y GET /academia/sesiones devuelve al admin TODOS los alumnos
// del centro (fetchDiarioVisible), mientras que a un profesor le devuelve
// solo los que tiene asignados.
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
export function createDarClaseSection({ renderDiarioFn = renderDiario } = {}) {
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

    await renderDiarioFn(diarioSlot, { fetchMisSustitucionesFn: async () => [] });
  }

  return { render };
}
