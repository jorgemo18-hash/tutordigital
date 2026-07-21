import { buildReciboEditor } from "./reciboEditor.js";
import { buildReciboPreview } from "./reciboPreview.js";
import { buildRegenerarBoton } from "./regenerarBoton.js";

// Tab "Recibo": reutiliza el editor/preview ya existentes tal cual (mismo
// componente que antes del rediseño) — esta función solo resuelve la
// carga (o su ausencia) y engancha las llamadas API, explícitas vía `api`/
// `branding`. Tras cualquier acción (guardar/enviar/regenerar/generar) se
// recarga solo el propio recibo y se avisa a `onCambio` para refrescar los
// puntos de estado de la lista, sin remontar el resto del panel.
export function buildTabRecibo(item, { mes, anio, api, branding, onCambio }) {
  const wrap = document.createElement("div");
  wrap.className = "ef-tab-body";

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

  // `reciboId` explícito (no `item.recibo.id`) para poder recargar tanto un
  // recibo ya existente como uno recién creado desde renderSinRecibo, que
  // no tiene reflejo en `item` hasta que se refresque la lista.
  async function cargar(reciboId) {
    renderCargando();
    let recibo;
    let textosExencion = [];
    try {
      [recibo, textosExencion] = await Promise.all([
        api.fetchRecibo(reciboId),
        api.fetchTextosLegales({ tipo: "recibos" }).catch(() => []),
      ]);
    } catch (err) {
      renderError(err);
      return;
    }
    wrap.innerHTML = "";
    wrap.appendChild(
      buildReciboEditor(recibo, {
        onGuardar: async (payload) => { await api.updateRecibo(recibo.id, payload); await cargar(recibo.id); onCambio(); },
        onEnviar: async () => { await api.enviarRecibo(recibo.id); await cargar(recibo.id); onCambio(); },
        onRegenerar: async (confirmar) => {
          try { return await api.regenerarRecibo(recibo.id, confirmar); } finally { await cargar(recibo.id); onCambio(); }
        },
      })
    );
    wrap.appendChild(buildReciboPreview(recibo, { ...branding, textosExencion }));
  }

  function renderSinRecibo() {
    wrap.innerHTML = "";
    const p = document.createElement("p");
    p.className = "ac-empty";
    p.textContent = "Esta familia no tiene recibo generado para este mes.";
    wrap.appendChild(p);
    wrap.appendChild(
      buildRegenerarBoton({
        textoIdle: "Generar recibo",
        textoCargando: "Generando…",
        textoOk: "✓ Generado",
        ejecutar: async () => {
          const { reciboId } = await api.generarReciboFamilia({ familia_id: item.familia_id, mes, anio });
          if (!reciboId) throw new Error("Ya existe un recibo para esta familia — recarga la página.");
          await cargar(reciboId);
          onCambio();
        },
      })
    );
  }

  if (item.recibo) cargar(item.recibo.id);
  else renderSinRecibo();

  return wrap;
}
