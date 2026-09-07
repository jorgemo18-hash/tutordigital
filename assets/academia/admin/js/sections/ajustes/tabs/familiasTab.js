import { fetchConfig, updateConfig } from "../../../api.js";
import { buildPreciosPanel } from "../precios/preciosPanel.js";

// Pestaña "Información para familias": todo lo que va impreso en la hoja
// que se le entrega a un padre (Documentos › Información para familias), y
// nada más. Antes los precios vivían en su propia pestaña y no había forma
// de ver de un vistazo qué dice el papel.
//
// Ajustes › Horario sigue siendo dónde se decide cuándo abre el centro.
// Aquí solo se decide qué se cuenta de ello.
//
// LO QUE SE QUITÓ Y POR QUÉ. Aquí hubo un panel "Cursos por hora" para
// marcar a mano qué nivel ocupa cada hora ("los martes a las 17:30 es
// Primaria") y que eso saliera impreso en la rejilla. Se retiró: era una
// cuadrícula de veinticinco casillas que había que rellenar a mano, se
// quedaba desfasada en cuanto cambiaba un alumno de hora, y en una academia
// con varios profesores a la misma hora conviven dos niveles, así que la
// etiqueta mentía más que ayudaba. Lo que de verdad se quería ver —dónde
// queda sitio— sale ya solo del horario real, sin rellenar nada.
//
// El modelo (assets/shared/js/horarioReservas.js), su columna en
// academia_config y el dibujo en el PDF siguen en su sitio: si algún día
// hace falta, vuelve con un panel, no con una migración.
export function buildFamiliasTab({ fetchConfigFn = fetchConfig, updateConfigFn = updateConfig } = {}) {
  const wrap = document.createElement("div");
  wrap.className = "ac-set-grid one";
  wrap.append(buildPreciosPanel({ fetchConfigFn, updateConfigFn }));
  return wrap;
}
