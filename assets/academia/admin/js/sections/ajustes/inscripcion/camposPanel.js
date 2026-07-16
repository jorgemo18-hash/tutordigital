import { fetchConfig, updateConfig } from "../../../api.js";
import { buildPanelHead, buildPanelFoot } from "../panelChrome.js";
import { BLOQUES } from "./blocks.js";

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

// Un bloque = cabecera (título + interruptor maestro, o una nota fija si
// no es apagable) + lista de interruptores de campo, sincronizados en las
// dos direcciones con el maestro: desmarcar la última casilla activa
// apaga "Incluir bloque"; marcar cualquier casilla lo enciende. Sin esto
// se podía guardar "incluido" con el bloque realmente vacío — el bug real
// que arregla esto: Autorizaciones marcado con su única casilla apagada
// imprimía el título "Autorizaciones" sin nada debajo (ver
// hoja_inscripcion.py, mismo caso corregido también en el generador).
function buildBloque(bloque, valores) {
  const box = document.createElement("div");
  box.className = "ac-inscripcion-bloque";

  const head = document.createElement("div");
  head.className = "ac-inscripcion-bloque-head";
  const titulo = document.createElement("span");
  titulo.className = "ac-inscripcion-bloque-titulo";
  titulo.textContent = bloque.label;
  head.appendChild(titulo);

  let maestroInput = null;
  if (bloque.maestro) {
    const maestro = buildToggle("Incluir bloque", valores.activo !== false);
    maestroInput = maestro.input;
    head.appendChild(maestro.wrap);
  } else if (bloque.nota) {
    const nota = document.createElement("span");
    nota.className = "ac-inscripcion-nota";
    nota.textContent = bloque.nota;
    head.appendChild(nota);
  }
  box.appendChild(head);

  const campoInputs = {};
  if (bloque.campos.length) {
    const lista = document.createElement("div");
    lista.className = "ac-inscripcion-campos";
    for (const campo of bloque.campos) {
      const toggle = buildToggle(campo.label, Boolean(valores[campo.key]));
      campoInputs[campo.key] = toggle.input;
      lista.appendChild(toggle.wrap);
    }
    box.appendChild(lista);

    if (maestroInput) {
      const inputsCampos = Object.values(campoInputs);
      for (const input of inputsCampos) {
        input.addEventListener("change", () => {
          if (input.checked) maestroInput.checked = true;
          else if (!inputsCampos.some((i) => i.checked)) maestroInput.checked = false;
        });
      }
      // La config guardada puede venir ya inconsistente (activo:true con
      // todas las casillas apagadas, el caso real de producción) — se
      // corrige también al cargar, no solo al interactuar.
      if (!inputsCampos.some((i) => i.checked)) maestroInput.checked = false;
    }
  }

  return { box, maestroInput, campoInputs };
}

function buildFirmaNota() {
  const box = document.createElement("div");
  box.className = "ac-inscripcion-bloque";
  const head = document.createElement("div");
  head.className = "ac-inscripcion-bloque-head";
  const titulo = document.createElement("span");
  titulo.className = "ac-inscripcion-bloque-titulo";
  titulo.textContent = "Firma";
  const nota = document.createElement("span");
  nota.className = "ac-inscripcion-nota";
  nota.textContent = "Siempre incluida";
  head.append(titulo, nota);
  box.appendChild(head);
  return box;
}

// "Campos de la hoja" — qué bloques/datos incluye la cara delantera de la
// hoja de inscripción (ver hoja_inscripcion.py en tutordigital-pdf-service,
// que lee este mismo shape del payload). Un único botón "Guardar" manda
// siempre el objeto completo (los 5 bloques con todas sus claves), nunca
// un parche parcial — así el backend no necesita hacer merge (ver
// InscripcionConfigSchema en academia.config.routes.js).
export function buildCamposPanel({ fetchConfigFn = fetchConfig, updateConfigFn = updateConfig } = {}) {
  const panel = document.createElement("div");
  panel.className = "ac-panel";
  panel.appendChild(buildPanelHead("Campos de la hoja", "Elige qué datos pide la hoja de inscripción impresa."));

  const cargando = document.createElement("p");
  cargando.className = "ac-loading";
  cargando.textContent = "Cargando…";
  panel.appendChild(cargando);

  function renderContenido(config) {
    cargando.remove();
    const valores = config.inscripcion_config || {};
    const bloquesUI = {};

    for (const bloque of BLOQUES) {
      const ui = buildBloque(bloque, valores[bloque.key] || {});
      bloquesUI[bloque.key] = ui;
      panel.appendChild(ui.box);
    }
    panel.appendChild(buildFirmaNota());

    const { foot, hint } = buildPanelFoot("Los cambios se aplican al generar la hoja de inscripción");
    const saveBtn = document.createElement("button");
    saveBtn.type = "button";
    saveBtn.className = "ac-btn primary";
    saveBtn.textContent = "Guardar";
    saveBtn.addEventListener("click", async () => {
      saveBtn.disabled = true;
      const hintOriginal = hint.textContent;
      try {
        const inscripcionConfig = {};
        for (const bloque of BLOQUES) {
          const ui = bloquesUI[bloque.key];
          const valorBloque = {};
          if (ui.maestroInput) valorBloque.activo = ui.maestroInput.checked;
          for (const [key, input] of Object.entries(ui.campoInputs)) valorBloque[key] = input.checked;
          inscripcionConfig[bloque.key] = valorBloque;
        }
        await updateConfigFn({ inscripcion_config: inscripcionConfig });
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
