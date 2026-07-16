import { fetchNormas, uploadNormas, descargarNormas } from "../../apiDocumentos.js";
import { readFileAsBase64 } from "../../fileUtils.js";
import { nombreArchivo } from "./preview/nombreArchivo.js";

const TITULO = "Normas de la academia";
const DOCX_MIME = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
const NORMAS_MIMES = ["application/pdf", DOCX_MIME];
const AVISO_DOCX_LEGADO =
  "Este documento está en formato Word y no puede previsualizarse — descárgalo o reemplázalo para convertirlo a PDF.";

// Tarjeta "Normas de la academia" (documento de normas propio, subido por el
// admin — PDF o DOCX; un DOCX se convierte a PDF en el momento de subirlo,
// ver normas.routes.js, así que solo un documento subido ANTES de ese
// cambio puede seguir en Word — ver mimeActual/AVISO_DOCX_LEGADO más
// abajo). Al montar comprueba si ya existe un documento (fetchNormasFn):
// si lo hay, el botón principal pasa a "Reemplazar" y aparece "Ver
// normas"; si no, queda solo "Subir normas". "Ver normas" carga el
// documento en la zona de vista previa embebida (ver preview/previewPanel.js)
// en vez de abrir una pestaña nueva.
export function buildNormasCard({
  preview,
  tenantNombre,
  fetchNormasFn = fetchNormas,
  uploadNormasFn = uploadNormas,
  descargarNormasFn = descargarNormas,
} = {}) {
  const card = document.createElement("div");
  card.className = "ac-doc-card";

  const title = document.createElement("div");
  title.className = "ac-doc-card-title";
  title.textContent = TITULO;

  const sub = document.createElement("div");
  sub.className = "ac-doc-card-sub";
  sub.textContent = "Documento PDF con las normas de tu centro";

  const actions = document.createElement("div");
  actions.className = "ac-doc-card-actions";

  const verBtn = document.createElement("button");
  verBtn.type = "button";
  verBtn.className = "ac-btn ghost hidden";
  verBtn.textContent = "Ver normas";

  const subirBtn = document.createElement("button");
  subirBtn.type = "button";
  subirBtn.className = "ac-btn ghost";
  subirBtn.textContent = "Subir normas";

  const input = document.createElement("input");
  input.type = "file";
  input.accept = ".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document";
  input.className = "ac-upload-input";

  const msg = document.createElement("div");
  msg.className = "ac-drawer-msg";

  actions.append(verBtn, subirBtn, input);
  card.append(title, sub, actions, msg);

  let tieneNormas = false;
  let mimeActual = null;

  function aplicarEstado() {
    verBtn.classList.toggle("hidden", !tieneNormas);
    subirBtn.textContent = tieneNormas ? "Reemplazar" : "Subir normas";
  }

  async function cargarPreview() {
    preview.abrirCargando(TITULO);
    try {
      const blob = await descargarNormasFn();
      if (mimeActual === DOCX_MIME) {
        preview.mostrarAviso({ titulo: TITULO, mensaje: AVISO_DOCX_LEGADO, blob, filename: nombreArchivo("normas", tenantNombre, "docx") });
      } else {
        preview.mostrarPdf({ blob, titulo: TITULO, filename: nombreArchivo("normas", tenantNombre) });
      }
    } catch (err) {
      preview.mostrarError(err.message || "No se pudo abrir el documento.", { onReintentar: cargarPreview });
    }
  }

  verBtn.addEventListener("click", cargarPreview);

  subirBtn.addEventListener("click", () => input.click());
  input.addEventListener("change", async () => {
    const file = input.files?.[0];
    input.value = "";
    if (!file) return;
    if (!NORMAS_MIMES.includes(file.type)) {
      msg.textContent = "Solo se aceptan documentos PDF o DOCX.";
      msg.className = "ac-drawer-msg error";
      return;
    }
    subirBtn.disabled = true;
    msg.textContent = "";
    msg.className = "ac-drawer-msg";
    try {
      const base64 = await readFileAsBase64(file);
      await uploadNormasFn({ base64, mime: file.type });
      // Un DOCX se convierte a PDF en la subida (ver normas.routes.js) —
      // lo guardado a partir de aquí es siempre PDF, aunque el archivo
      // elegido fuera Word.
      tieneNormas = true;
      mimeActual = "application/pdf";
      aplicarEstado();
      msg.textContent = "✓ Guardado";
      msg.className = "ac-drawer-msg ok";
    } catch (err) {
      msg.textContent = err.message || "No se pudo subir el documento.";
      msg.className = "ac-drawer-msg error";
    }
    subirBtn.disabled = false;
  });

  fetchNormasFn()
    .then((normas) => {
      tieneNormas = Boolean(normas);
      mimeActual = normas?.mime || null;
      aplicarEstado();
    })
    .catch((err) => {
      msg.textContent = err.message || "No se pudo comprobar si ya hay un documento subido.";
      msg.className = "ac-drawer-msg error";
    });

  return card;
}
