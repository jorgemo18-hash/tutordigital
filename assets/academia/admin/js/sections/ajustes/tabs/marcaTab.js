import { buildPersonalizacionPanel } from "../personalizacionPanel.js";
import { buildTextosLegalesPanel } from "../textosLegalesPanel.js";
import { buildEmailAcompanamientoPanel } from "../emailAcompanamientoPanel.js";

export function buildMarcaTab({ onLogoActualizado, onBgActualizado } = {}) {
  const wrap = document.createElement("div");
  wrap.className = "ac-set-grid two";
  wrap.append(
    buildPersonalizacionPanel({ onLogoActualizado, onBgActualizado }),
    buildTextosLegalesPanel(),
    buildEmailAcompanamientoPanel()
  );
  return wrap;
}
