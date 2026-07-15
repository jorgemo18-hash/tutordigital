import { buildCamposPanel } from "../inscripcion/camposPanel.js";
import { buildTextoPanel } from "../inscripcion/textoPanel.js";

export function buildInscripcionTab() {
  const wrap = document.createElement("div");
  wrap.className = "ac-set-grid two";
  wrap.append(buildCamposPanel(), buildTextoPanel());
  return wrap;
}
