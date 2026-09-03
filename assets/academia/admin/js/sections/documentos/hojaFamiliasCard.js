import { descargarHojaFamilias } from "../../apiDocumentos.js";
import { nombreArchivo } from "./preview/nombreArchivo.js";

const TITULO = "Información para familias";

// Tarjeta "Información para familias" — el horario y los precios del centro
// en un cuarto de folio, cuatro veces en el mismo A4 para imprimir y
// cortar. Se genera en el momento a partir de la configuración (Ajustes ›
// Horario y Ajustes › Precios): no se guarda en ningún sitio, así que nunca
// se entrega un papel con el horario del mes pasado.
//
// Mismo patrón que hojaInscripcionCard: el PDF se muestra en la zona de
// vista previa embebida, y el panel se encarga de la descarga autenticada,
// del estado de carga y de revocar el object URL anterior.
export function buildHojaFamiliasCard({ preview, tenantNombre, descargarFn = descargarHojaFamilias } = {}) {
  const card = document.createElement("div");
  card.className = "ac-doc-card";

  const title = document.createElement("div");
  title.className = "ac-doc-card-title";
  title.textContent = TITULO;

  const sub = document.createElement("div");
  sub.className = "ac-doc-card-sub";
  sub.textContent = "Horario y precios en un cuarto de folio · 4 por hoja, listas para cortar";

  const actions = document.createElement("div");
  actions.className = "ac-doc-card-actions";

  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = "ac-btn ghost";
  btn.textContent = "Abrir";
  actions.appendChild(btn);

  async function cargarPreview() {
    preview.abrirCargando(TITULO);
    try {
      const blob = await descargarFn();
      preview.mostrarPdf({ blob, titulo: TITULO, filename: nombreArchivo("informacion-familias", tenantNombre) });
    } catch (err) {
      preview.mostrarError(err.message || "No se pudo generar la hoja para familias.", { onReintentar: cargarPreview });
    }
  }

  btn.addEventListener("click", cargarPreview);

  card.append(title, sub, actions);
  return card;
}
