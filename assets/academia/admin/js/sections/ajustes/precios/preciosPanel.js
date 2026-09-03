import { fetchConfig, updateConfig } from "../../../api.js";
import { buildPanelHead, buildPanelFoot } from "../panelChrome.js";
import { buildTablaPrecios } from "./tablaPreciosDom.js";
import { preciosPorDefecto, normalizarPrecios, LIMITES_PRECIOS } from "../../../../../../shared/js/preciosPublicos.js";

const TITULO = "Precios";
const DESC =
  "La lista de precios que se imprime en la hoja para familias. No es la tarifa de cada alumno: " +
  "esa se pone en su ficha y es la que sale en los recibos.";

// Ajustes › Precios — el editor de la lista de precios pública
// (academia_config.precios_publicos, migración 112). Solo guarda: quien la
// imprime es Documentos › Información para familias.

function buildNotaField(valor, onEscribir) {
  const wrap = document.createElement("div");
  wrap.className = "ac-field";
  const label = document.createElement("label");
  label.className = "ac-field-label";
  label.textContent = "Nota al pie (opcional)";
  const input = document.createElement("input");
  input.className = "ac-input";
  input.type = "text";
  input.value = valor || "";
  input.placeholder = "Matrícula gratuita · 10 % de descuento a hermanos";
  input.maxLength = LIMITES_PRECIOS.MAX_NOTA;
  input.addEventListener("input", () => onEscribir(input.value));
  wrap.append(label, input);
  return wrap;
}

export function buildPreciosPanel({ fetchConfigFn = fetchConfig, updateConfigFn = updateConfig } = {}) {
  const panel = document.createElement("div");
  panel.className = "ac-panel";
  panel.appendChild(buildPanelHead(TITULO, DESC));

  const cargando = document.createElement("p");
  cargando.className = "ac-loading";
  cargando.textContent = "Cargando…";
  panel.appendChild(cargando);

  function renderContenido(config) {
    cargando.remove();

    // Un centro que nunca abrió esta pestaña (columna a NULL) empieza con
    // la tabla típica de una academia y las casillas de precio VACÍAS: se
    // rellena lo que se cobra y se borra lo que no se da, que es mucho más
    // rápido que montarla desde una pantalla en blanco. Lo que se guarda es
    // siempre lo que quede en pantalla, no este ejemplo.
    const guardado = config?.precios_publicos ? normalizarPrecios(config.precios_publicos) : preciosPorDefecto();

    const { foot, hint } = buildPanelFoot("Pon precio solo donde cobres: las casillas vacías no se imprimen");
    let nota = guardado.nota;

    const tabla = buildTablaPrecios(guardado, {
      onCambio: () => { hint.textContent = "Sin guardar"; },
    });

    panel.append(tabla.el, buildNotaField(nota, (valor) => {
      nota = valor;
      hint.textContent = "Sin guardar";
    }));

    const saveBtn = document.createElement("button");
    saveBtn.type = "button";
    saveBtn.className = "ac-btn primary";
    saveBtn.textContent = "Guardar";
    saveBtn.addEventListener("click", async () => {
      saveBtn.disabled = true;
      try {
        await updateConfigFn({ precios_publicos: { ...tabla.getValue(), nota } });
        hint.textContent = "✓ Guardado";
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
