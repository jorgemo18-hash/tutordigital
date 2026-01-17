// assets/app/attachmentUI.js
// UI del preview de adjunto (miniatura + nombre + X) dentro del composer.

export function createAttachmentUI({ inp, update, onClear } = {}) {
  let attachPreviewEl = null;
  let attachPreviewImg = null;
  let attachPreviewName = null;

  function ensureAttachPreviewUI() {
    if (attachPreviewEl) return;

    attachPreviewEl = document.createElement("div");
    attachPreviewEl.id = "attachPreview";
    attachPreviewEl.style.display = "none";
    attachPreviewEl.style.alignItems = "center";
    attachPreviewEl.style.gap = "10px";
    attachPreviewEl.style.padding = "8px 10px";
    attachPreviewEl.style.borderRadius = "12px";
    attachPreviewEl.style.border = "1px solid rgba(0,0,0,.08)";
    attachPreviewEl.style.background = "rgba(255,255,255,.75)";

    attachPreviewEl.style.order = -1;
    attachPreviewEl.style.flexBasis = "100%";
    attachPreviewEl.style.width = "100%";
    attachPreviewEl.style.justifyContent = "flex-start";
    attachPreviewEl.style.marginBottom = "8px";

    attachPreviewImg = document.createElement("img");
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
    btnX.style.width = "34px";
    btnX.style.height = "34px";
    btnX.style.borderRadius = "10px";
    btnX.style.border = "1px solid rgba(0,0,0,.10)";
    btnX.style.background = "white";
    btnX.style.cursor = "pointer";
    btnX.addEventListener("click", () => {
      try { typeof onClear === "function" && onClear(); } catch {}
      hideAttachPreview();
      try { typeof update === "function" && update(); } catch {}
    });

    attachPreviewEl.appendChild(attachPreviewImg);
    attachPreviewEl.appendChild(attachPreviewName);
    attachPreviewEl.appendChild(btnX);

    const footerRow = document.querySelector(".footerRow");
    if (footerRow) footerRow.prepend(attachPreviewEl);
  }

  function showAttachPreview(file) {
  ensureAttachPreviewUI();
  if (!attachPreviewEl) return;

  const url = URL.createObjectURL(file);
  attachPreviewImg.src = url;
  attachPreviewImg.onload = () => URL.revokeObjectURL(url);

  attachPreviewName.textContent = "";
  attachPreviewName.style.display = "none";

  attachPreviewEl.style.display = "flex";

  
  if (window.__ttdUpdateLayout) window.__ttdUpdateLayout();
}

  function hideAttachPreview() {
    if (!attachPreviewEl) return;
    attachPreviewEl.style.display = "none";
    if (attachPreviewImg) attachPreviewImg.src = "";
    if (attachPreviewName) attachPreviewName.textContent = "";
    if (window.__ttdUpdateLayout) window.__ttdUpdateLayout();
  }

  return { showAttachPreview, hideAttachPreview };
}