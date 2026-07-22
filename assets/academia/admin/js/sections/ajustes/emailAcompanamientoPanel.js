import { fetchConfig, updateConfig } from "../../api.js";
import { buildPanelHead, buildPanelFoot, buildVarchip } from "./panelChrome.js";

const VARIABLES = ["{mes}", "{anio}", "{total}", "{familia}"];
const GUARDADO_MS = 1700;

// "Email a familias" — texto de acompañamiento del email que lleva el
// recibo y el informe como PDF adjuntos (ver server/lib/academiaEnvio/
// textoAcompanamiento.js, que hace la sustitución real al enviar). Mismo
// patrón que "Plantilla de concepto" (facturacionTab.js): campo único en
// academia_config, chips de variables insertables, guardado explícito.
export function buildEmailAcompanamientoPanel({ fetchConfigFn = fetchConfig, updateConfigFn = updateConfig } = {}) {
  const panel = document.createElement("div");
  panel.className = "ac-panel";

  const cargando = document.createElement("p");
  cargando.className = "ac-loading";
  cargando.textContent = "Cargando…";
  panel.appendChild(cargando);

  function renderContenido(config) {
    cargando.remove();
    panel.appendChild(buildPanelHead("Email a familias", "Texto de acompañamiento del email con el recibo y el informe adjuntos."));

    const textarea = document.createElement("textarea");
    textarea.className = "ac-textarea";
    textarea.rows = 3;
    textarea.value = config.email_texto_acompanamiento || "";
    panel.appendChild(textarea);

    const chips = document.createElement("div");
    chips.className = "ac-varchips";
    for (const variable of VARIABLES) {
      chips.appendChild(buildVarchip(variable, (texto) => {
        const pos = textarea.selectionStart ?? textarea.value.length;
        textarea.value = textarea.value.slice(0, pos) + texto + textarea.value.slice(pos);
        textarea.focus();
        actualizarAvisoTotal();
      }));
    }
    panel.appendChild(chips);

    // Aviso no bloqueante, en vivo (no solo tras guardar) — para que nadie
    // se quede sin la cifra por un borrado accidental del {total}. No
    // impide guardar en ningún caso.
    const avisoTotal = document.createElement("span");
    avisoTotal.className = "ac-drawer-msg";
    panel.appendChild(avisoTotal);
    function actualizarAvisoTotal() {
      avisoTotal.textContent = textarea.value.includes("{total}")
        ? ""
        : "Este texto no incluye {total} — la familia no verá el importe del recibo.";
    }
    textarea.addEventListener("input", actualizarAvisoTotal);
    actualizarAvisoTotal();

    const { foot, hint } = buildPanelFoot();
    const saveBtn = document.createElement("button");
    saveBtn.type = "button";
    saveBtn.className = "ac-btn primary";
    saveBtn.textContent = "Guardar";
    saveBtn.addEventListener("click", async () => {
      saveBtn.disabled = true;
      try {
        await updateConfigFn({ email_texto_acompanamiento: textarea.value });
        const previo = hint.textContent;
        hint.textContent = "✓ Guardado";
        setTimeout(() => { hint.textContent = previo; }, GUARDADO_MS);
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
