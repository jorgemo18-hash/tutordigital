import { fetchCatalogoEjercicios, generarHojaEjercicios } from "../apiEjercicios.js";
import { buildControles } from "./ejercicios/controles.js";
import { createVisorDeHoja } from "./ejercicios/visorDeHoja.js";

// LA SECCIÓN "EJERCICIOS": el generador de hojas como un servicio más de la
// academia. Jorge, el 23/9: *"ponlo también en academias, que es un servicio
// más... lo usen o no, y así lo usaré yo para testearlo en la academia"*.
//
// Primera versión, y lo que NO hace está dicho en la ruta
// (academia.hojas-ejercicios.routes.js): la hoja no se guarda, así que el pie
// sale sin código. Imprimir sí, que es lo que hace falta para probarla en
// clase.
//
// Deps inyectables para test, mismo patrón que el resto de secciones.
export function createEjerciciosSection({
  fetchCatalogoFn = fetchCatalogoEjercicios,
  generarFn = generarHojaEjercicios,
  createVisorFn = createVisorDeHoja,
  centro = "",
} = {}) {
  let catalogo = null;
  // Lo último elegido se conserva al salir y volver a la sección.
  let eleccion = { objetivo: 1, intensidad: "normal" };
  let peticion = 0;

  async function generar({ controles, visor, msgEl }, nuevaEleccion) {
    eleccion = { objetivo: nuevaEleccion.objetivo, intensidad: nuevaEleccion.intensidad };
    // Si se pulsan dos cosas seguidas, solo cuenta la última respuesta: una
    // hoja vieja que llega tarde no puede tapar la que se acaba de pedir.
    peticion += 1;
    const esta = peticion;
    msgEl.textContent = "Generando la hoja…";
    msgEl.className = "ej-msg";
    controles.setOcupado(true);
    try {
      const { hoja } = await generarFn(eleccion);
      if (esta !== peticion) return;
      visor.pintar({ ...hoja, centro });
      msgEl.textContent = "";
    } catch (err) {
      if (esta !== peticion) return;
      msgEl.textContent = err?.message || "No se pudo generar la hoja.";
      msgEl.className = "ej-msg ac-field-hint--error";
    } finally {
      if (esta === peticion) controles.setOcupado(false);
    }
  }

  async function render(mainShell) {
    mainShell.innerHTML = "";
    const head = document.createElement("div");
    head.className = "ac-body-head";
    const title = document.createElement("h1");
    title.className = "ac-title";
    title.textContent = "Ejercicios";
    head.appendChild(title);

    const body = document.createElement("div");
    body.className = "ej-seccion";
    const msgEl = document.createElement("p");
    msgEl.className = "ej-msg";
    mainShell.append(head, body);

    try {
      catalogo = catalogo || await fetchCatalogoFn();
    } catch (err) {
      msgEl.textContent = err?.message || "No se pudo cargar el generador.";
      msgEl.className = "ej-msg ac-field-hint--error";
      body.appendChild(msgEl);
      return;
    }

    const visor = createVisorFn();
    const partes = { visor, msgEl, controles: null };
    partes.controles = buildControles({
      catalogo,
      inicial: eleccion,
      onCambio: (e) => generar(partes, e),
      onOtraVersion: (e) => generar(partes, e),
      onImprimir: () => visor.imprimir(),
    });

    const subtitulo = document.createElement("p");
    subtitulo.className = "ac-field-hint ej-sub";
    subtitulo.textContent = `${catalogo.materia} · ${catalogo.curso} · ${catalogo.tema}`;

    body.append(subtitulo, partes.controles.el, msgEl, visor.el);
    await generar(partes, eleccion);
  }

  return { render };
}
