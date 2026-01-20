// assets/app/AttachmentsUI.js

// UI del preview de adjunto (miniatura + nombre + X) dentro del composer.

function getFileBadge(file) {
  const type = String(file?.type || "");
  const name = String(file?.name || "");
  const lower = name.toLowerCase();
  const ext = lower.includes(".") ? lower.split(".").pop() : "";

  if (type === "application/pdf" || ext === "pdf") return "PDF";
  if (
    type === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
    ext === "docx"
  ) return "DOCX";
  if (type === "application/msword" || ext === "doc") return "DOC";
  if (/^image\//.test(type)) return "IMG";
  return "FILE";
}

export function createAttachmentUI({ inp, update, onClear } = {}) {
  let attachPreviewEl = null;
  let attachPreviewImg = null;
  let attachPreviewName = null;
  let currentObjectUrl = null;

  const footerRow = () => document.querySelector(".footerRow");
  const attachRow = () => document.getElementById("attachRow");

  function isMobile() {
    return !!(window.matchMedia && window.matchMedia("(max-width: 720px)").matches);
  }

  function getMount() {
    const row = attachRow();
    const foot = footerRow();
    return isMobile() ? foot : (row || foot);
  }

  function setAttachRowVisible(on) {
    const row = attachRow();
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

    // OJO: NO forzamos width/flex/order aquí. Eso lo gobierna el CSS.
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
    const type = String(f.type || "");
    const name = String(f.name || "Adjunto");

    const isImage = /^image\//.test(type);

    // Archivos (PDF/Word/otros): icono + nombre
    if (!isImage) {
      const badge = getFileBadge(f);

      // Icono simple (SVG inline) con badge (PDF / DOCX / DOC / FILE)
      const svg =
        "<svg xmlns='http://www.w3.org/2000/svg' width='64' height='64' viewBox='0 0 64 64'>" +
        "<rect x='10' y='6' width='44' height='52' rx='8' fill='%23ffffff' stroke='%23d9d9d9'/>" +
        "<path d='M44 6 L54 16 L54 58 Q54 60 52 60 H44 Z' fill='%23f3f3f3' stroke='%23d9d9d9'/>" +
        "<rect x='16' y='34' width='32' height='16' rx='6' fill='%23000000' opacity='0.06'/>" +
        "<text x='32' y='46' text-anchor='middle' font-family='Arial' font-size='12' font-weight='700' fill='%23333'>" +
        badge +
        "</text>" +
        "</svg>";

      attachPreviewImg.src = `data:image/svg+xml;utf8,${svg}`;
      attachPreviewName.textContent = name;
      attachPreviewName.style.display = "block";
      return;
    }

    // Imagen: miniatura (y ocultamos nombre para que quede limpio)
    currentObjectUrl = URL.createObjectURL(file);
    attachPreviewImg.src = currentObjectUrl;
    attachPreviewImg.onload = () => {
      // No revocar aquí si luego necesitamos repaint: lo revocamos en hide o al cambiar de archivo
    };

    attachPreviewName.textContent = "";
    attachPreviewName.style.display = "none";
  }

  function reflowPreview() {
    if (!attachPreviewEl) return;

    const mount = getMount();
    if (!mount) return;

    // Mueve el nodo si cambia el layout (móvil/desktop)
    if (attachPreviewEl.parentElement !== mount) {
      mount.prepend(attachPreviewEl);
    }

    // Desktop: mostrar fila superior dedicada
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