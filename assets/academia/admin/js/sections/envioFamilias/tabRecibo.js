import { buildReciboEditor } from "./reciboEditor.js";
import { buildReciboPreview } from "./reciboPreview.js";

// Tab "Recibo": reutiliza el editor/preview ya existentes tal cual (mismo
// componente que antes del rediseño) — esta función solo resuelve la
// carga (o su ausencia) y engancha las llamadas API, explícitas vía `api`/
// `branding`. Tras cualquier acción (guardar/enviar/regenerar) se
// recarga solo el propio recibo y se avisa a `onCambio` para refrescar los
// puntos de estado de la lista, sin remontar el resto del panel.
export function buildTabRecibo(item, { api, branding, onCambio }) {
  const wrap = document.createElement("div");
  wrap.className = "ef-tab-body";

  if (!item.recibo) {
    const p = document.createElement("p");
    p.className = "ac-empty";
    p.textContent = 'Esta familia no tiene recibo generado para este mes. Usa "Generar recibos" arriba.';
    wrap.appendChild(p);
    return wrap;
  }

  function renderCargando() {
    wrap.innerHTML = "";
    const p = document.createElement("p");
    p.className = "ac-loading";
    p.textContent = "Cargando recibo…";
    wrap.appendChild(p);
  }

  function renderError(err) {
    wrap.innerHTML = "";
    const p = document.createElement("p");
    p.className = "ac-error";
    p.textContent = err.message || "No se pudo cargar el recibo.";
    wrap.appendChild(p);
  }

  async function cargar() {
    renderCargando();
    let recibo;
    let textosExencion = [];
    try {
      [recibo, textosExencion] = await Promise.all([
        api.fetchRecibo(item.recibo.id),
        api.fetchTextosLegales({ tipo: "recibos" }).catch(() => []),
      ]);
    } catch (err) {
      renderError(err);
      return;
    }
    wrap.innerHTML = "";
    wrap.appendChild(
      buildReciboEditor(recibo, {
        onGuardar: async (payload) => { await api.updateRecibo(recibo.id, payload); await cargar(); onCambio(); },
        onEnviar: async () => { await api.enviarRecibo(recibo.id); await cargar(); onCambio(); },
        onRegenerar: async () => { try { await api.regenerarRecibo(recibo.id); } finally { await cargar(); onCambio(); } },
      })
    );
    wrap.appendChild(buildReciboPreview(recibo, { ...branding, textosExencion }));
  }

  cargar();
  return wrap;
}
