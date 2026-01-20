import { STATE } from "../../lib/state.js";
import { stopMic } from "../../lib/mic.js";
// assets/features/attach/attach.js
// Encapsula la UI de adjuntos (botón + y selector de archivo) y avisa con onFile(file)

export function initAttach({ onFile, dropEl } = {}) {
  const moreBtn = document.getElementById("more");
  const filePick = document.getElementById("filePick");

  if (!moreBtn || !filePick) {
    console.warn("initAttach: faltan #more o #filePick");
    return;
  }

 const acceptFile = (file) => {
  if (!file) return false;
  const type = String(file.type || "");
  const name = String(file.name || "");

  const isImage = /^image\//.test(type);
  const isPDF = type === "application/pdf" || (!type && /\.pdf$/i.test(name));
  const isDocx =
    type === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
    (!type && /\.docx$/i.test(name));
  const isDoc = type === "application/msword" || (!type && /\.doc$/i.test(name));

  return isImage || isPDF || isDocx || isDoc;
};

const emitInvalid = (file) => {
  try {
    window.dispatchEvent(new CustomEvent("ttd:attach-invalid", { detail: { file } }));
  } catch {}
};

  const handleDroppedFiles = (files) => {
    try { if (STATE?.isRecording) stopMic(); } catch {}
    // iOS: si el input tenía foco, quita teclado antes de procesar
    try { document.activeElement && document.activeElement.blur && document.activeElement.blur(); } catch {}

    const list = Array.from(files || []);
    if (!list.length) return;

    // Por ahora: solo el primer archivo válido
    const file = list.find(acceptFile);
if (!file) {
  emitInvalid(list[0]);
  return;
}

    try {
      if (typeof onFile === "function") onFile(file);
    } catch (err) {
      console.error(err);
    }
  };

  // Click en + -> abrir selector nativo (única vía: sin menú Cámara/Foto)
  moreBtn.addEventListener("click", (e) => {
    try { if (STATE?.isRecording) stopMic(); } catch {}
    e.preventDefault();
    e.stopPropagation();

    // iOS: cierra teclado antes de abrir el picker
    try { document.activeElement && document.activeElement.blur && document.activeElement.blur(); } catch {}

    // Reinicia selector para que dispare change aunque elijas el mismo archivo
    filePick.value = "";

    // No forzar cámara (si existiese capture, iOS lo respeta)
    filePick.removeAttribute("capture");

    // abre selector nativo
    filePick.click();
  });

  // Cuando el usuario elige un archivo
  filePick.addEventListener("change", () => {
    const file = filePick.files && filePick.files[0];
    if (!file) return;
    if (!acceptFile(file)) {
  emitInvalid(file);
  return;
}

    // iOS: tras elegir archivo, evita que el input se quede con foco (teclado abierto)
    try { document.activeElement && document.activeElement.blur && document.activeElement.blur(); } catch {}

    if (!acceptFile(file)) return;

    try {
      if (typeof onFile === "function") onFile(file);
    } catch (err) {
      console.error(err);
    }
  });

  // =========================
  // Drag & drop (desktop): arrastra imagen/PDF al chat
  // =========================
  const target = dropEl || document;

  const onDragOver = (e) => {
    try {
      // Solo si hay archivos
      const dt = e.dataTransfer;
      if (!dt || !dt.types || !Array.from(dt.types).includes("Files")) return;
    } catch {}

    e.preventDefault();
    try { document.body.classList.add("dragging"); } catch {}
  };

  const onDragLeave = () => {
    try { document.body.classList.remove("dragging"); } catch {}
  };

  const onDrop = (e) => {
    try {
      const dt = e.dataTransfer;
      if (!dt || !dt.files || !dt.files.length) return;
      e.preventDefault();
      handleDroppedFiles(dt.files);
    } finally {
      onDragLeave();
    }
  };

  try {
    target.addEventListener("dragover", onDragOver);
    target.addEventListener("dragenter", onDragOver);
    target.addEventListener("dragleave", onDragLeave);
    target.addEventListener("drop", onDrop);

    // Seguridad: si sueltas fuera, limpia estado visual
    window.addEventListener("drop", onDragLeave);
    window.addEventListener("dragend", onDragLeave);
  } catch (e) {
    console.warn("initAttach: drag&drop no disponible", e);
  }
}