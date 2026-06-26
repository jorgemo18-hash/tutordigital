import { buildPersonalizacionPanel } from "../personalizacionPanel.js";
import { buildTextosLegalesPanel } from "../textosLegalesPanel.js";

export function buildMarcaTab({ onLogoActualizado, onBgActualizado } = {}) {
  const wrap = document.createElement("div");
  wrap.className = "ac-set-grid two";
  wrap.append(buildPersonalizacionPanel({ onLogoActualizado, onBgActualizado }), buildTextosLegalesPanel());
  return wrap;
}
