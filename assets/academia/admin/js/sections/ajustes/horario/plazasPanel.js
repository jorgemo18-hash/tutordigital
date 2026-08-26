import { fetchConfig, updateConfig } from "../../../api.js";
import { buildPanelHead, buildPanelFoot } from "../panelChrome.js";

// "Plazas por franja" — academia_config.max_alumnos_por_franja (migración
// 106). En panel propio y no dentro de horarioTab.js porque ese archivo ya
// va por 291 líneas con dos paneles dentro; un tercero lo dejaría rozando el
// límite de 400.
//
// Vacío = sin límite, y es el valor por defecto: un centro que no lo ha
// configurado no debe empezar a ver avisos de "lleno" contra un número que
// nadie ha decidido. Con el campo vacío la rejilla sigue mostrando cuántos
// alumnos hay en cada franja, simplemente sin compararlos con nada.
export function buildPlazasPanel({ fetchConfigFn = fetchConfig, updateConfigFn = updateConfig } = {}) {
  const panel = document.createElement("div");
  panel.className = "ac-panel";

  const cargando = document.createElement("p");
  cargando.className = "ac-loading";
  cargando.textContent = "Cargando…";
  panel.appendChild(cargando);

  function renderContenido(config) {
    cargando.remove();
    panel.appendChild(buildPanelHead(
      "Plazas por franja",
      "Cuántos alumnos caben a la vez en una misma hora. Se muestra en la rejilla de horario de cada ficha para que veas si queda hueco. Avisa, nunca impide guardar."
    ));

    const field = document.createElement("div");
    field.className = "ac-field";
    const label = document.createElement("label");
    label.className = "ac-field-label";
    label.textContent = "Máximo de alumnos por franja";
    const input = document.createElement("input");
    input.className = "ac-input";
    input.type = "number";
    input.min = "1";
    input.max = "99";
    input.step = "1";
    input.placeholder = "Sin límite";
    input.value = config.max_alumnos_por_franja ?? "";
    field.append(label, input);
    panel.appendChild(field);

    const nota = document.createElement("p");
    nota.className = "ac-field-msg";
    nota.textContent = "Déjalo vacío si no quieres límite.";
    panel.appendChild(nota);

    const { foot, hint } = buildPanelFoot();
    const saveBtn = document.createElement("button");
    saveBtn.type = "button";
    saveBtn.className = "ac-btn primary";
    saveBtn.textContent = "Guardar";
    saveBtn.addEventListener("click", async () => {
      const bruto = input.value.trim();
      // Vacío -> null explícito (sin límite). Un 0 o un negativo no son
      // "sin límite", son un error de tecleo: se avisa en vez de guardarlos.
      const valor = bruto === "" ? null : Number(bruto);
      if (valor !== null && (!Number.isInteger(valor) || valor < 1 || valor > 99)) {
        hint.textContent = "Escribe un número entre 1 y 99, o déjalo vacío.";
        return;
      }
      saveBtn.disabled = true;
      const hintOriginal = hint.textContent;
      try {
        await updateConfigFn({ max_alumnos_por_franja: valor });
        hint.textContent = "✓ Guardado";
      } catch (err) {
        hint.textContent = err.message || "No se pudo guardar.";
      }
      saveBtn.disabled = false;
      setTimeout(() => { hint.textContent = hintOriginal; }, 1700);
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
