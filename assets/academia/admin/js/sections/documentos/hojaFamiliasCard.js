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
  sub.textContent = "Horario y precios · Imprimir saca 4 por hoja; Descargar, una sola para enviar";

  const actions = document.createElement("div");
  actions.className = "ac-doc-card-actions";

  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = "ac-btn ghost";
  btn.textContent = "Abrir";
  actions.appendChild(btn);

  // SE PIDEN LAS DOS VERSIONES DE GOLPE, y no la de una cuartilla al pulsar
  // "Descargar". Son dos peticiones de milisegundos (cuatro rectángulos con
  // pdfkit, sin caché ni microservicio), y traerlas juntas deja el botón de
  // descargar síncrono: sin estado de "generando" dentro de un botón, sin un
  // error que aparezca a mitad de la descarga y sin poder pulsarlo dos veces.
  //
  // Y si la de una cuartilla falla, NO se cae la vista previa: se muestra el
  // folio de cuatro igual y el botón de descargar baja eso (ver el `||` de
  // descargar() en previewPanel.js). Perder la comodidad del WhatsApp es un
  // problema menor que no poder imprimir cuando hay una familia esperando.
  async function cargarPreview() {
    preview.abrirCargando(TITULO);
    try {
      const [folio, cuartilla] = await Promise.all([
        descargarFn(),
        descargarFn({ copias: 1 }).catch(() => null),
      ]);
      preview.mostrarPdf({
        blob: folio,
        blobDescarga: cuartilla || undefined,
        titulo: TITULO,
        filename: nombreArchivo("informacion-familias", tenantNombre),
      });
    } catch (err) {
      preview.mostrarError(err.message || "No se pudo generar la hoja para familias.", { onReintentar: cargarPreview });
    }
  }

  btn.addEventListener("click", cargarPreview);

  card.append(title, sub, actions);
  return card;
}
