import { fetchConfig, updateConfig } from "../../../api.js";
import { buildPanelHead, buildPanelFoot, buildVarchip } from "../panelChrome.js";
import { buildDescuentosPanel } from "../descuentosPanel.js";
import { buildCategoriasGastoPanel } from "../categoriasGastoPanel.js";
import { buildToggle } from "../toggle.js";
import { MODO_ENVIO_POR_DEFECTO, modoDeEnvio } from "../../../../../../shared/js/periodosDeEnvio.js";

const PLANTILLA_EJEMPLOS = ["Clases {mes} {año}", "Clases {mes} en {academia}"];

// Qué va en el envío mensual (migración 145). Dos modos y no más: ver
// assets/shared/js/periodosDeEnvio.js.
// Etiquetas cortas (en el móvil el desplegable corta a unos 38 caracteres);
// la explicación de cada una va debajo, y cambia con la elección.
const OPCIONES_MODO_ENVIO = [
  { value: "informe_mes_anterior", label: "Recibo del mes + informe del anterior", ayuda: "Para cobrar a principio de mes: el envío de octubre lleva el recibo de octubre y el informe de septiembre." },
  { value: "mismo_mes", label: "Recibo e informe del mismo mes", ayuda: "Para cobrar a mes vencido: el envío de octubre lleva el recibo y el informe de octubre." },
];

function buildSelectModoEnvio(valor) {
  const wrap = document.createElement("div");
  wrap.className = "ac-field";
  const label = document.createElement("label");
  label.className = "ac-field-label";
  label.textContent = "Qué se manda cada mes";
  const select = document.createElement("select");
  select.className = "ac-input";
  for (const op of OPCIONES_MODO_ENVIO) {
    const option = document.createElement("option");
    option.value = op.value;
    option.textContent = op.label;
    select.appendChild(option);
  }
  select.value = modoDeEnvio(valor);
  const ayuda = document.createElement("p");
  ayuda.className = "ac-field-hint";
  const pintarAyuda = () => { ayuda.textContent = OPCIONES_MODO_ENVIO.find((op) => op.value === select.value)?.ayuda || ""; };
  select.addEventListener("change", pintarAyuda);
  pintarAyuda();
  wrap.style.marginTop = "12px";
  wrap.append(label, select, ayuda);
  return { wrap, select };
}

// Lo escrito en el campo del día, como lo guarda la base de datos: vacío o
// fuera de 1–28 es null (sin aviso), para no mandar un 31 que no existe en
// febrero ni un texto que el servidor rechazaría entero.
export function diaDeEnvio(valor) {
  const n = Number(String(valor ?? "").trim());
  return String(valor ?? "").trim() && Number.isInteger(n) && n >= 1 && n <= 28 ? n : null;
}

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

    const modoEnvio = buildSelectModoEnvio(config.modo_envio);
    panel.appendChild(modoEnvio.wrap);

    // Día del envío (migración 146): desde ese día, franja "Toca el envío…
    // Revisar" arriba del panel hasta que esté hecho. Vacío = sin aviso.
    const diaEnvio = buildField("Día del envío a familias (vacío: sin aviso)", {
      type: "number", min: "1", max: "28", step: "1", placeholder: "Por ejemplo, 5",
      value: config.dia_envio ?? "",
    });
    panel.appendChild(diaEnvio.wrap);

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
          modo_envio: modoEnvio.select.value || MODO_ENVIO_POR_DEFECTO,
          dia_envio: diaDeEnvio(diaEnvio.input.value),
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
