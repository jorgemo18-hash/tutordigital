import { fetchConfig, updateConfig } from "../../../api.js";
import { buildPreciosPanel } from "../precios/preciosPanel.js";

// Pestaña "Precios" de Ajustes. Un solo panel por ahora: la tabla es ancha
// y necesita la fila entera, así que la rejilla va en `one` en vez de en
// dos columnas como Horario.
export function buildPreciosTab({ fetchConfigFn = fetchConfig, updateConfigFn = updateConfig } = {}) {
  const wrap = document.createElement("div");
  wrap.className = "ac-set-grid one";
  wrap.appendChild(buildPreciosPanel({ fetchConfigFn, updateConfigFn }));
  return wrap;
}
