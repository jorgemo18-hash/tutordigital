// Drop de archivo sobre la columna ENUNCIADO — deja el archivo en
// #ctxFilePick y dispara su evento "change", el mismo camino que usa el
// botón "Adjuntar archivo" (ver ctxFileManager.js). Sin handler global:
// el listener vive scoped al propio contenedor de ENUNCIADO (#tutorCtxPane),
// no en document — así un drop sobre RESOLUCIÓN (columna de chat, scoped
// aparte en coreui.js) nunca llega aquí.
const ACCEPTED_PREFIX = "image/";
const ACCEPTED_EXACT = "application/pdf";

function isAcceptedFile(file) {
  return !!file && (file.type.startsWith(ACCEPTED_PREFIX) || file.type === ACCEPTED_EXACT);
}

function hasFiles(e) {
  const dt = e.dataTransfer;
  return !!(dt && dt.types && Array.from(dt.types).includes("Files"));
}

export function initCtxDropZone(dropEl, ctxFilePick) {
  if (!dropEl || !ctxFilePick) return () => {};

  let dragDepth = 0;

  const onDragOver = (e) => {
    if (!hasFiles(e)) return;
    e.preventDefault();
    dragDepth += 1;
    dropEl.classList.add("ctx-dragging");
  };

  const onDragLeave = () => {
    dragDepth = Math.max(0, dragDepth - 1);
    if (dragDepth === 0) dropEl.classList.remove("ctx-dragging");
  };

  const onDrop = (e) => {
    if (!hasFiles(e)) return;
    e.preventDefault();
    dragDepth = 0;
    dropEl.classList.remove("ctx-dragging");

    const file = Array.from(e.dataTransfer.files || []).find(isAcceptedFile);
    if (!file) return;

    const dt = new DataTransfer();
    dt.items.add(file);
    ctxFilePick.files = dt.files;
    ctxFilePick.dispatchEvent(new Event("change", { bubbles: true }));
  };

  dropEl.addEventListener("dragover", onDragOver);
  dropEl.addEventListener("dragenter", onDragOver);
  dropEl.addEventListener("dragleave", onDragLeave);
  dropEl.addEventListener("drop", onDrop);

  return function cleanup() {
    dropEl.removeEventListener("dragover", onDragOver);
    dropEl.removeEventListener("dragenter", onDragOver);
    dropEl.removeEventListener("dragleave", onDragLeave);
    dropEl.removeEventListener("drop", onDrop);
  };
}
