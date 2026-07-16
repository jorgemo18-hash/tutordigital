import { descargarHojaInscripcion } from "../../apiDocumentos.js";
import { nombreArchivo } from "./preview/nombreArchivo.js";

const TITULO = "Hoja de inscripción";

// Tarjeta "Hoja de inscripción" — genera el PDF en el momento (sin
// guardar nada) y lo muestra en la zona de vista previa embebida (ver
// documentosSection.js), no en una pestaña nueva: el panel ya se encarga
// de descargar el blob autenticado, mostrar el estado de carga y revocar
// el object URL anterior.
export function buildHojaInscripcionCard({ preview, tenantNombre, descargarFn = descargarHojaInscripcion } = {}) {
  const card = document.createElement("div");
  card.className = "ac-doc-card";

  const title = document.createElement("div");
  title.className = "ac-doc-card-title";
  title.textContent = TITULO;

  const sub = document.createElement("div");
  sub.className = "ac-doc-card-sub";
  sub.textContent = "Plantilla en PDF para captar datos del alumno y la familia";

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
      preview.mostrarPdf({ blob, titulo: TITULO, filename: nombreArchivo("hoja-inscripcion", tenantNombre) });
    } catch (err) {
      preview.mostrarError(err.message || "No se pudo generar la hoja de inscripción.", { onReintentar: cargarPreview });
    }
  }

  btn.addEventListener("click", cargarPreview);

  card.append(title, sub, actions);
  return card;
}
