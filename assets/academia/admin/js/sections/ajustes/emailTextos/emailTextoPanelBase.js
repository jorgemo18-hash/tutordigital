import { fetchConfig, updateConfig } from "../../../api.js";
import { buildPanelHead, buildPanelFoot, buildVarchip } from "../panelChrome.js";

const GUARDADO_MS = 1700;

// Builder genérico de un panel de Ajustes "textarea + chips + aviso no
// bloqueante + Guardar" para UN texto configurable de academia_config —
// reutilizado por los 3 casos de envío (completo/solo_recibo/
// solo_informe, ver el resto de esta carpeta) en vez de repetir la misma
// estructura 3 veces: son idénticos salvo el campo, las variables
// ofrecidas y cuáles de esas son "esperadas" (avisan si faltan).
// `variablesEsperadas` es un subconjunto de `variables` — p.ej. en
// "solo informe" no hay ninguna esperada porque no hay {total} que perder.
export function buildEmailTextoPanel({
  campo,
  titulo,
  descripcion,
  variables,
  variablesEsperadas = [],
  fetchConfigFn = fetchConfig,
  updateConfigFn = updateConfig,
}) {
  const panel = document.createElement("div");
  panel.className = "ac-panel";

  const cargando = document.createElement("p");
  cargando.className = "ac-loading";
  cargando.textContent = "Cargando…";
  panel.appendChild(cargando);

  function renderContenido(config) {
    cargando.remove();
    panel.appendChild(buildPanelHead(titulo, descripcion));

    const textarea = document.createElement("textarea");
    textarea.className = "ac-textarea";
    textarea.rows = 3;
    textarea.value = config[campo] || "";
    panel.appendChild(textarea);

    const chips = document.createElement("div");
    chips.className = "ac-varchips";
    for (const variable of variables) {
      chips.appendChild(buildVarchip(variable, (texto) => {
        const pos = textarea.selectionStart ?? textarea.value.length;
        textarea.value = textarea.value.slice(0, pos) + texto + textarea.value.slice(pos);
        textarea.focus();
        actualizarAviso();
      }));
    }
    panel.appendChild(chips);

    // Aviso no bloqueante, en vivo (no solo tras guardar) — nunca impide
    // guardar, solo avisa si falta alguna variable esperada de este caso.
    const aviso = document.createElement("span");
    aviso.className = "ac-drawer-msg";
    panel.appendChild(aviso);
    function actualizarAviso() {
      const faltan = variablesEsperadas.filter((v) => !textarea.value.includes(v));
      aviso.textContent = faltan.length
        ? `Este texto no incluye ${faltan.join(", ")} — la familia no verá esa información.`
        : "";
    }
    textarea.addEventListener("input", actualizarAviso);
    actualizarAviso();

    const { foot, hint } = buildPanelFoot();
    const saveBtn = document.createElement("button");
    saveBtn.type = "button";
    saveBtn.className = "ac-btn primary";
    saveBtn.textContent = "Guardar";
    saveBtn.addEventListener("click", async () => {
      saveBtn.disabled = true;
      try {
        await updateConfigFn({ [campo]: textarea.value });
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
