import { fetchConfig, updateConfig } from "../../../api.js";
import { buildCursosPorHoraPanel } from "../familias/cursosPorHoraPanel.js";
import { buildPreciosPanel } from "../precios/preciosPanel.js";

// Pestaña "Información para familias": todo lo que va impreso en la hoja
// que se le entrega a un padre (Documentos › Información para familias), y
// nada más. Antes esto estaba repartido —los precios en su propia pestaña y
// los cursos por hora colgando de Horario— y no había forma de ver de un
// vistazo qué dice el papel.
//
// Ajustes › Horario sigue siendo dónde se decide cuándo abre el centro.
// Aquí solo se decide qué se cuenta de ello.
export function buildFamiliasTab({ fetchConfigFn = fetchConfig, updateConfigFn = updateConfig } = {}) {
  const wrap = document.createElement("div");
  wrap.className = "ac-set-grid one";
  wrap.append(
    buildCursosPorHoraPanel({ fetchConfigFn, updateConfigFn }),
    buildPreciosPanel({ fetchConfigFn, updateConfigFn })
  );
  return wrap;
}
