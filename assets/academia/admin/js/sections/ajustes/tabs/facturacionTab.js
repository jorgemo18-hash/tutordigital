import { fetchConfig, updateConfig } from "../../../api.js";
import { buildPanelHead, buildPanelFoot, buildVarchip } from "../panelChrome.js";
import { buildDescuentosPanel } from "../descuentosPanel.js";
import { buildCategoriasGastoPanel } from "../categoriasGastoPanel.js";

const PLANTILLA_EJEMPLOS = ["Clases {mes} {año}", "Clases {mes} en {academia}"];

function buildField(label, attrs = {}) {
  const wrap = document.createElement("div");
  wrap.className = "ac-field";
  const span = document.createElement("label");
  span.className = "ac-field-label";
  span.textContent = label;
  wrap.appendChild(span);
  const input = document.createElement("input");
  input.className = "ac-input";
  Object.entries(attrs).forEach(([key, value]) => { input[key] = value; });
  wrap.appendChild(input);
  return { wrap, input };
}

function buildToggle(label, checked) {
  const wrap = document.createElement("label");
  wrap.className = "ac-toggle";
  const input = document.createElement("input");
  input.type = "checkbox";
  input.checked = checked;
  const span = document.createElement("span");
  span.textContent = label;
  wrap.append(input, span);
  return { wrap, input };
}

// "Recibos" — plantilla de concepto, conectada a academia_config (igual
// que antes del rediseño, solo con las clases nuevas — .ac-panel-head/
// .ac-panel-foot/.ac-varchip). El texto de exención de IVA ya no se edita
// aquí: vive en Ajustes › Marca y textos › Textos legales
// (academia_textos_legales, tipo "recibos" — ver textosLegalesPanel.js).
function buildRecibosPanel({ fetchConfigFn, updateConfigFn }) {
  const panel = document.createElement("div");
  panel.className = "ac-panel";

  const cargando = document.createElement("p");
  cargando.className = "ac-loading";
  cargando.textContent = "Cargando…";
  panel.appendChild(cargando);

  function renderContenido(config) {
    cargando.remove();
    panel.appendChild(buildPanelHead("Recibos", "Plantilla de concepto y leyendas legales que se imprimen en cada recibo."));

    const plantilla = buildField("Plantilla de concepto", {
      type: "text",
      placeholder: "Clases {mes} {año}",
      value: config.concepto_recibo_plantilla || "",
    });
    panel.appendChild(plantilla.wrap);

    const chips = document.createElement("div");
    chips.className = "ac-varchips";
    for (const ejemplo of PLANTILLA_EJEMPLOS) {
      chips.appendChild(buildVarchip(ejemplo, (texto) => { plantilla.input.value = texto; }));
    }
    panel.appendChild(chips);

    const enviarAlPagar = buildToggle(
      "Enviar recibo automáticamente al marcar como pagado",
      Boolean(config.enviar_recibo_al_pagar)
    );
    enviarAlPagar.wrap.style.marginTop = "4px";
    panel.appendChild(enviarAlPagar.wrap);

    const { foot, hint } = buildPanelFoot();
    const actualizarVistaPrevia = () => {
      hint.textContent = `Vista previa: ${plantilla.input.value.replace("{mes}", "junio").replace("{año}", "2026")}`;
    };
    plantilla.input.addEventListener("input", actualizarVistaPrevia);
    actualizarVistaPrevia();

    const saveBtn = document.createElement("button");
    saveBtn.type = "button";
    saveBtn.className = "ac-btn primary";
    saveBtn.textContent = "Guardar";
    saveBtn.addEventListener("click", async () => {
      saveBtn.disabled = true;
      try {
        await updateConfigFn({
          concepto_recibo_plantilla: plantilla.input.value.trim() || "Clases {mes} {año}",
          enviar_recibo_al_pagar: enviarAlPagar.input.checked,
        });
        const previo = hint.textContent;
        hint.textContent = "✓ Guardado";
        setTimeout(() => { hint.textContent = previo; }, 1700);
      } catch (err) {
        hint.textContent = err.message || "No se pudo guardar.";
      }
      saveBtn.disabled = false;
    });
    foot.appendChild(saveBtn);
    panel.appendChild(foot);
  }

  fetchConfigFn()
    .then((config) => renderContenido(config || {}))
    .catch((err) => {
      cargando.textContent = err.message || "No se pudo cargar la configuración.";
      cargando.className = "ac-error";
    });

  return panel;
}

export function buildFacturacionTab({ fetchConfigFn = fetchConfig, updateConfigFn = updateConfig } = {}) {
  const wrap = document.createElement("div");
  wrap.className = "ac-set-grid two";
  wrap.append(buildRecibosPanel({ fetchConfigFn, updateConfigFn }), buildDescuentosPanel(), buildCategoriasGastoPanel());
  return wrap;
}
