import { buildPersonalizacionPanel } from "../personalizacionPanel.js";
import { buildTextosLegalesPanel } from "../textosLegalesPanel.js";
import { buildEmailTextoCompletoPanel } from "../emailTextos/completoPanel.js";
import { buildEmailTextoSoloReciboPanel } from "../emailTextos/soloReciboPanel.js";
import { buildEmailTextoSoloInformePanel } from "../emailTextos/soloInformePanel.js";

export function buildMarcaTab({ onLogoActualizado, onBgActualizado } = {}) {
  const wrap = document.createElement("div");
  wrap.className = "ac-set-grid two";
  wrap.append(
    buildPersonalizacionPanel({ onLogoActualizado, onBgActualizado }),
    buildTextosLegalesPanel(),
    buildEmailTextoCompletoPanel(),
    buildEmailTextoSoloReciboPanel(),
    buildEmailTextoSoloInformePanel()
  );
  return wrap;
}
