// assets/app/attachments/attach.js
// UI de adjuntos (botón + y selector de archivo) + drag&drop.
// Desacoplado: no depende de STATE; puede parar dictado vía callback stopRecording().

import { isAcceptedFile, getFileKind } from "../lib/files.js";

function blurActiveElement() {
  try {
    const el = document.activeElement;
    if (el && typeof el.blur === "function") el.blur();
  } catch {}
}

function emitInvalid(file, reason = "unsupported") {
  try {
    const info = file ? getFileKind(file) : null;
    window.dispatchEvent(
      new CustomEvent("ttd:attach-invalid", { detail: { file, reason, kind: info?.kind } })
    );
  } catch {}
}

/**
 * Inicializa el sistema de adjuntos.
 * @param {Object} opts
 * @param {(file: File) => void} opts.onFile
 * @param {HTMLElement} [opts.dropEl]
 * @param {() => void} [opts.stopRecording] - callback para parar dictado (si aplica)
 * @param {(file: File) => boolean} [opts.acceptFile]
 * @returns {() => void} cleanup
 */
export function initAttach({ onFile, dropEl, stopRecording, acceptFile = isAcceptedFile } = {}) {
  const moreBtn = document.getElementById("more");
  const filePick = document.getElementById("filePick");

  if (!moreBtn || !filePick) {
    console.warn("initAttach: faltan #more o #filePick");
    return () => {};
  }

  const handleFile = (file) => {
    if (!file) return;
    if (!acceptFile(file)) {
      emitInvalid(file, "unsupported");
      return;
    }
    try {
      if (typeof onFile === "function") onFile(file);
    } catch (err) {
      console.error(err);
    }
  };

  const handleDroppedFiles = (files) => {
    try { stopRecording?.(); } catch {}

    // iOS: cerrar teclado antes de procesar
    blurActiveElement();

    const list = Array.from(files || []);
    if (!list.length) return;

    const file = list.find(acceptFile);
    if (!file) {
      emitInvalid(list[0], "unsupported");
      return;
    }
    handleFile(file);
  };

  const onMoreClick = (e) => {
    try { stopRecording?.(); } catch {}
    e.preventDefault();
    e.stopPropagation();

    blurActiveElement();

    try { filePick.value = ""; } catch {}
    try { filePick.removeAttribute("capture"); } catch {}

    try { filePick.click(); } catch {}
  };

  const onFilePickChange = () => {
    const file = filePick.files && filePick.files[0];
    if (!file) return;
    blurActiveElement();
    handleFile(file);
  };

  moreBtn.addEventListener("click", onMoreClick);
  filePick.addEventListener("change", onFilePickChange);

  // Drag & drop (desktop)
  const target = dropEl || document;
  let dragDepth = 0;

  const onDragOver = (e) => {
    try {
      const dt = e.dataTransfer;
      if (!dt || !dt.types || !Array.from(dt.types).includes("Files")) return;
    } catch {
      return;
    }
    e.preventDefault();
    dragDepth = Math.max(0, dragDepth + 1);
    try { document.body.classList.add("dragging"); } catch {}
  };

  const onDragLeave = () => {
    dragDepth = Math.max(0, dragDepth - 1);
    if (dragDepth === 0) {
      try { document.body.classList.remove("dragging"); } catch {}
    }
  };

  const onDrop = (e) => {
    try {
      const dt = e.dataTransfer;
      if (!dt) return;
      if (!dt.types || !Array.from(dt.types).includes("Files")) return;
      if (!dt.files || !dt.files.length) return;
      e.preventDefault();
      handleDroppedFiles(dt.files);
    } finally {
      dragDepth = 0;
      onDragLeave();
    }
  };

  try {
    target.addEventListener("dragover", onDragOver);
    target.addEventListener("dragenter", onDragOver);
    target.addEventListener("dragleave", onDragLeave);
    target.addEventListener("drop", onDrop);

    window.addEventListener("drop", onDragLeave);
    window.addEventListener("dragend", onDragLeave);
  } catch (e) {
    console.warn("initAttach: drag&drop no disponible", e);
  }

  return function cleanupAttach() {
    try { moreBtn.removeEventListener("click", onMoreClick); } catch {}
    try { filePick.removeEventListener("change", onFilePickChange); } catch {}

    try {
      target.removeEventListener("dragover", onDragOver);
      target.removeEventListener("dragenter", onDragOver);
      target.removeEventListener("dragleave", onDragLeave);
      target.removeEventListener("drop", onDrop);
    } catch {}

    try { window.removeEventListener("drop", onDragLeave); } catch {}
    try { window.removeEventListener("dragend", onDragLeave); } catch {}
  };
}