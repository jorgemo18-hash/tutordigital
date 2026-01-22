// assets/app/attachments/attachmentsui.js
// UI del preview de adjunto (miniatura + nombre + X) dentro del composer.

import { getFileKind } from "../lib/files.js";

/**
 * Devuelve metadatos de UI según el tipo de archivo.
 * Importante: esto SOLO afecta al preview visual, no a los tipos soportados por backend.
 * @param {File} file
 * @returns {{ label: string, cls: string, isImage: boolean }}
 */
export function getPreviewKind(file) {
  const info = getFileKind(file);
  if (info.isPDF) return { label: "PDF", cls: "pdf", isImage: false };
  if (info.isDocx) return { label: "DOCX", cls: "docx", isImage: false };
  if (info.isImage) return { label: "IMG", cls: "img", isImage: true };
  return { label: "FILE", cls: "file", isImage: false };
}

function defaultIconDataUrl(kind) {
  // SVG sencillo tipo "documento" con etiqueta.
  // Usamos encodeURIComponent para evitar problemas de caracteres en data URLs.
  const svg =
    "<svg xmlns='http://www.w3.org/2000/svg' width='64' height='64' viewBox='0 0 64 64'>" +
    "<rect x='10' y='6' width='44' height='52' rx='8' fill='%23ffffff' stroke='%23d9d9d9'/>" +
    "<path d='M44 6 L54 16 L54 58 Q54 60 52 60 H44 Z' fill='%23f3f3f3' stroke='%23d9d9d9'/>" +
    "<rect x='16' y='34' width='32' height='16' rx='6' fill='%23000000' opacity='0.06'/>" +
    "<text x='32' y='46' text-anchor='middle' font-family='Arial' font-size='12' font-weight='700' fill='%23333'>" +
    String(kind?.label || "FILE") +
    "</text>" +
    "</svg>";

  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

/**
 * Crea la UI del preview de adjuntos dentro del composer.
 * @param {Object} opts
 * @param {HTMLInputElement|HTMLTextAreaElement} opts.inp
 * @param {Function} opts.update
 * @param {Function} opts.onClear
 * @param {boolean} [opts.debug=false]
 * @param {(kind: {label:string,cls:string,isImage:boolean}, file: File) => string} [opts.iconRenderer]
 *        Debe devolver un dataURL (p.ej. "data:image/svg+xml;...") para archivos NO imagen.
 */
export function createAttachmentUI({ inp, update, onClear, debug = false, iconRenderer } = {}) {
  let attachPreviewEl = null;
  let attachPreviewImg = null;
  let attachPreviewName = null;
  let currentObjectUrl = null;

  // Cachea nodos (son estáticos en esta app)
  const footerRowEl = document.querySelector(".footerRow");
  const attachRowEl = document.getElementById("attachRow");

  const getFooterRow = () => footerRowEl || document.querySelector(".footerRow");
  const getAttachRow = () => attachRowEl || document.getElementById("attachRow");

  function isMobile() {
    return !!(window.matchMedia && window.matchMedia("(max-width: 720px)").matches);
  }

  function getMount() {
    const row = getAttachRow();
    const foot = getFooterRow();
    return isMobile() ? foot : (row || foot);
  }

  function setAttachRowVisible(on) {
    const row = getAttachRow();
    if (!row) return;
    row.classList.toggle("show", !!on);
  }

  function clearObjectUrl() {
    if (currentObjectUrl) {
      try { URL.revokeObjectURL(currentObjectUrl); } catch {}
      currentObjectUrl = null;
    }
  }

  function ensureAttachPreviewUI() {
    if (attachPreviewEl) return;

    attachPreviewEl = document.createElement("div");
    attachPreviewEl.id = "attachPreview";
    attachPreviewEl.classList.add("attachPreview");
    attachPreviewEl.style.display = "none";
    attachPreviewEl.style.alignItems = "center";
    attachPreviewEl.style.gap = "10px";

    attachPreviewImg = document.createElement("img");
    attachPreviewImg.alt = "Adjunto";
    attachPreviewImg.style.width = "44px";
    attachPreviewImg.style.height = "44px";
    attachPreviewImg.style.objectFit = "cover";
    attachPreviewImg.style.borderRadius = "10px";
    attachPreviewImg.style.border = "1px solid rgba(0,0,0,.08)";

    attachPreviewName = document.createElement("div");
    attachPreviewName.classList.add("attachName");
    attachPreviewName.style.fontSize = "13px";
    attachPreviewName.style.opacity = "0.85";
    attachPreviewName.style.flex = "1";
    attachPreviewName.style.overflow = "hidden";
    attachPreviewName.style.whiteSpace = "nowrap";
    attachPreviewName.style.textOverflow = "ellipsis";
    attachPreviewName.style.maxWidth = "220px";

    const btnX = document.createElement("button");
    btnX.type = "button";
    btnX.textContent = "✕";
    btnX.addEventListener("click", () => {
      try { typeof onClear === "function" && onClear(); } catch {}
      hideAttachPreview();
      try { typeof update === "function" && update(); } catch {}
    });

    attachPreviewEl.appendChild(attachPreviewImg);
    attachPreviewEl.appendChild(attachPreviewName);
    attachPreviewEl.appendChild(btnX);

    const mount = getMount();
    if (mount) mount.prepend(attachPreviewEl);
  }

  function setFilePreview(file) {
    clearObjectUrl();

    const f = file || {};
    const name = String(f.name || "Adjunto");
    const kind = getPreviewKind(f);

    if (debug) {
      try { console.log("[attachPreview] setFilePreview", { name, kind, type: f?.type }); } catch {}
    }

    // Limpia clases de tipo (para colorear nombre)
    if (attachPreviewName) {
      attachPreviewName.classList.remove("pdf", "docx", "file", "img");
      attachPreviewName.classList.add(kind.cls);
    }

    // Archivos (PDF/Word/otros): icono + nombre
    if (!kind.isImage) {
      const dataUrl =
        (typeof iconRenderer === "function" ? iconRenderer(kind, file) : null) ||
        defaultIconDataUrl(kind);

      if (attachPreviewImg) attachPreviewImg.src = dataUrl;
      if (attachPreviewName) {
        attachPreviewName.textContent = name;
        attachPreviewName.style.display = "block";
      }
      return;
    }

    // Imagen: miniatura (y ocultamos nombre)
    try {
      currentObjectUrl = URL.createObjectURL(file);
      if (attachPreviewImg) attachPreviewImg.src = currentObjectUrl;
    } catch {
      // fallback visual si el objectURL falla
      if (attachPreviewImg) attachPreviewImg.src = defaultIconDataUrl({ label: "IMG" });
    }

    if (attachPreviewName) {
      attachPreviewName.textContent = "";
      attachPreviewName.style.display = "none";
    }
  }

  function reflowPreview() {
    if (!attachPreviewEl) return;

    const mount = getMount();
    if (!mount) return;

    if (attachPreviewEl.parentElement !== mount) {
      mount.prepend(attachPreviewEl);
    }

    setAttachRowVisible(!isMobile() && attachPreviewEl.style.display !== "none");
  }

  function showAttachPreview(file) {
    ensureAttachPreviewUI();
    if (!attachPreviewEl) return;

    setFilePreview(file);

    attachPreviewEl.style.display = "flex";
    try { document.body.classList.add("hasAttach"); } catch {}

    reflowPreview();
    if (window.__ttdUpdateLayout) window.__ttdUpdateLayout();
  }

  function hideAttachPreview() {
    if (!attachPreviewEl) return;

    attachPreviewEl.style.display = "none";

    clearObjectUrl();
    if (attachPreviewImg) attachPreviewImg.src = "";
    if (attachPreviewName) attachPreviewName.textContent = "";

    setAttachRowVisible(false);

    try { document.body.classList.remove("hasAttach"); } catch {}
    if (window.__ttdUpdateLayout) window.__ttdUpdateLayout();
  }

  return { showAttachPreview, hideAttachPreview, reflowPreview };
}
