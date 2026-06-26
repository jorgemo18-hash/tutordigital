import { fetchConfig, updateConfig } from "../../../api.js";
import { buildPanelHead, buildPanelFoot } from "../panelChrome.js";
import { buildDescuentosPanel } from "../descuentosPanel.js";

const PLANTILLA_EJEMPLOS = ["Clases {mes} {año}", "Clases {mes} en {academia}"];
const TEXTO_EXENCION_IVA_DEFAULT =
  "Servicio educativo exento de IVA según el artículo 20.Uno.9º de la Ley 37/1992 del IVA.";

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

function buildTextareaField(label, attrs = {}) {
  const wrap = document.createElement("div");
  wrap.className = "ac-field";
  const span = document.createElement("label");
  span.className = "ac-field-label";
  span.textContent = label;
  wrap.appendChild(span);
  const textarea = document.createElement("textarea");
  textarea.className = "ac-textarea";
  Object.entries(attrs).forEach(([key, value]) => { textarea[key] = value; });
  wrap.appendChild(textarea);
  return { wrap, input: textarea };
}

function buildVarchip(texto, onClick) {
  const chip = document.createElement("button");
  chip.type = "button";
  chip.className = "ac-varchip";
  chip.textContent = texto;
  chip.addEventListener("click", () => onClick(texto));
  return chip;
}

// "Recibos" — plantilla de concepto + texto de exención de IVA, ya
// conectados a academia_config (igual que antes del rediseño), solo con
// las clases nuevas (.ac-panel-head/.ac-panel-foot/.ac-varchip).
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

    const exencion = buildTextareaField("Texto de exención de IVA", {
      rows: 3,
      value: config.texto_exencion_iva || TEXTO_EXENCION_IVA_DEFAULT,
    });
    panel.appendChild(exencion.wrap);

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
          texto_exencion_iva: exencion.input.value.trim(),
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
  wrap.append(buildRecibosPanel({ fetchConfigFn, updateConfigFn }), buildDescuentosPanel());
  return wrap;
}
